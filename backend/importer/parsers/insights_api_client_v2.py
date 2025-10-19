"""
Enhanced IBM Storage Insights REST API v2 Client

Improvements over original:
- Parallel/concurrent requests for faster data fetching
- Granular filtering options for selective imports
- Better error handling and retry logic
- Rate limiting with exponential backoff
- Smart caching for reference data
- Detailed progress tracking
"""

import asyncio
import aiohttp
import requests
import time
from typing import Dict, List, Optional, Tuple, Callable
from django.core.cache import cache
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

logger = logging.getLogger(__name__)


class StorageInsightsClientV2:
    """Enhanced API client for IBM Storage Insights with parallel request support"""

    def __init__(self, tenant_id: str, api_key: str, max_workers: int = 5):
        self.tenant_id = tenant_id
        self.api_key = api_key
        self.base_url = f"https://insights.ibm.com/restapi/v1/tenants/{tenant_id}"
        self.max_workers = max_workers
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def _get_auth_token(self) -> str:
        """Get authentication token with caching"""
        cache_key = f"insights_token_{self.tenant_id}"
        token = cache.get(cache_key)

        if token:
            return token

        auth_url = f"{self.base_url}/token"
        headers = {
            "x-api-key": self.api_key,
            "Accept": "application/json"
        }

        response = self.session.post(auth_url, headers=headers)
        response.raise_for_status()

        token_data = response.json()
        token = token_data.get('result', {}).get('token')
        if not token:
            raise ValueError("No access token received from API")

        # Cache for 45 minutes (tokens typically last 1 hour)
        cache.set(cache_key, token, 45 * 60)
        return token

    def _make_request(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
        max_retries: int = 3
    ) -> Dict:
        """Make authenticated API request with retry logic and exponential backoff"""
        token = self._get_auth_token()
        headers = {'x-api-token': token, 'Accept': 'application/json'}
        url = f"{self.base_url}/{endpoint}"

        for attempt in range(max_retries):
            try:
                response = self.session.get(
                    url,
                    headers=headers,
                    params=params,
                    timeout=60
                )

                if response.status_code == 401:
                    # Token expired, clear cache and retry once
                    if attempt == 0:
                        cache.delete(f"insights_token_{self.tenant_id}")
                        token = self._get_auth_token()
                        headers['x-api-token'] = token
                        continue
                    else:
                        raise Exception("Authentication failed after token refresh")

                if response.status_code == 429:
                    # Rate limited, exponential backoff
                    wait_time = (2 ** attempt) * 1
                    logger.warning(f"Rate limited, waiting {wait_time}s before retry")
                    time.sleep(wait_time)
                    continue

                response.raise_for_status()
                return response.json()

            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise
                wait_time = (2 ** attempt) * 0.5
                logger.warning(f"Request failed (attempt {attempt + 1}), retrying in {wait_time}s: {e}")
                time.sleep(wait_time)

        raise Exception(f"Max retries exceeded for {endpoint}")

    def get_storage_systems(
        self,
        filters: Optional[Dict] = None,
        progress_callback: Optional[Callable] = None
    ) -> List[Dict]:
        """
        Get all storage systems with optional filtering.

        Args:
            filters: Optional dict with keys:
                - type: Filter by storage type (e.g., 'FlashSystem', 'DS8000')
                - status: Filter by status (e.g., 'online', 'offline')
                - location: Filter by location
            progress_callback: Optional callback function(current, total, message)

        Returns:
            List of storage system dictionaries
        """
        try:
            if progress_callback:
                progress_callback(0, 1, "Fetching storage systems...")

            data = self._make_request("storage-systems")
            systems = data.get('data', [])

            # Apply filters if provided
            if filters:
                if 'type' in filters and filters['type']:
                    systems = [s for s in systems if filters['type'].lower() in s.get('type', '').lower()]
                if 'status' in filters and filters['status']:
                    systems = [s for s in systems if s.get('status', '').lower() == filters['status'].lower()]
                if 'location' in filters and filters['location']:
                    systems = [s for s in systems if filters['location'].lower() in s.get('location', '').lower()]

            if progress_callback:
                progress_callback(1, 1, f"Found {len(systems)} storage systems")

            return systems

        except Exception as e:
            raise Exception(f"Failed to fetch storage systems: {str(e)}")

    def get_volumes_parallel(
        self,
        storage_system_ids: List[str],
        filters: Optional[Dict] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, List[Dict]]:
        """
        Get volumes for multiple storage systems in parallel.

        Args:
            storage_system_ids: List of storage system IDs
            filters: Optional dict with keys:
                - pool: Filter by pool name
                - status: Filter by status
                - type: Filter by volume type (thin/thick)
            progress_callback: Optional callback function(current, total, message)

        Returns:
            Dict mapping storage_system_id to list of volumes
        """
        volumes_by_system = {}
        completed = 0
        total = len(storage_system_ids)

        def fetch_volumes_for_system(system_id: str) -> Tuple[str, List[Dict]]:
            """Fetch volumes for a single system"""
            try:
                volumes = self._get_volumes_paginated(system_id, filters)
                return (system_id, volumes)
            except Exception as e:
                logger.error(f"Error fetching volumes for {system_id}: {e}")
                return (system_id, [])

        # Use ThreadPoolExecutor for parallel requests
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_system = {
                executor.submit(fetch_volumes_for_system, sys_id): sys_id
                for sys_id in storage_system_ids
            }

            for future in as_completed(future_to_system):
                system_id, volumes = future.result()
                volumes_by_system[system_id] = volumes
                completed += 1

                if progress_callback:
                    progress_callback(
                        completed,
                        total,
                        f"Fetched volumes for {completed}/{total} systems ({len(volumes)} volumes)"
                    )

        return volumes_by_system

    def _get_volumes_paginated(
        self,
        storage_system_id: str,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Get all volumes for a storage system with pagination"""
        all_volumes = []
        offset = 1
        limit = 500

        while True:
            endpoint = f"storage-systems/{storage_system_id}/volumes"
            params = {'limit': limit, 'offset': offset}

            data = self._make_request(endpoint, params)
            volumes = data.get('data', [])

            if not volumes:
                break

            # Apply filters
            if filters:
                if 'pool' in filters and filters['pool']:
                    volumes = [v for v in volumes if filters['pool'].lower() in v.get('pool', '').lower()]
                if 'status' in filters and filters['status']:
                    volumes = [v for v in volumes if v.get('status', '').lower() == filters['status'].lower()]
                if 'type' in filters and filters['type']:
                    volumes = [v for v in volumes if v.get('type', '').lower() == filters['type'].lower()]

            all_volumes.extend(volumes)

            # Check if there are more pages
            if len(volumes) < limit:
                break

            offset += limit

        return all_volumes

    def get_hosts_parallel(
        self,
        storage_system_ids: List[str],
        filters: Optional[Dict] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, List[Dict]]:
        """
        Get hosts for multiple storage systems in parallel.

        Args:
            storage_system_ids: List of storage system IDs
            filters: Optional dict with keys:
                - os_type: Filter by OS type
                - status: Filter by connection status
            progress_callback: Optional callback function(current, total, message)

        Returns:
            Dict mapping storage_system_id to list of hosts
        """
        hosts_by_system = {}
        completed = 0
        total = len(storage_system_ids)

        def fetch_hosts_for_system(system_id: str) -> Tuple[str, List[Dict]]:
            """Fetch hosts for a single system"""
            try:
                hosts = self._get_hosts_paginated(system_id, filters)
                return (system_id, hosts)
            except Exception as e:
                logger.error(f"Error fetching hosts for {system_id}: {e}")
                return (system_id, [])

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_system = {
                executor.submit(fetch_hosts_for_system, sys_id): sys_id
                for sys_id in storage_system_ids
            }

            for future in as_completed(future_to_system):
                system_id, hosts = future.result()
                hosts_by_system[system_id] = hosts
                completed += 1

                if progress_callback:
                    progress_callback(
                        completed,
                        total,
                        f"Fetched hosts for {completed}/{total} systems ({len(hosts)} hosts)"
                    )

        return hosts_by_system

    def _get_hosts_paginated(
        self,
        storage_system_id: str,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Get all hosts for a storage system with pagination"""
        all_hosts = []
        offset = 1
        limit = 500

        while True:
            endpoint = f"storage-systems/{storage_system_id}/host-connections"
            params = {'limit': limit, 'offset': offset}

            data = self._make_request(endpoint, params)
            hosts = data.get('data', [])

            if not hosts:
                break

            # Apply filters
            if filters:
                if 'os_type' in filters and filters['os_type']:
                    hosts = [h for h in hosts if filters['os_type'].lower() in h.get('os_type', '').lower()]
                if 'status' in filters and filters['status']:
                    hosts = [h for h in hosts if h.get('status', '').lower() == filters['status'].lower()]

            all_hosts.extend(hosts)

            if len(hosts) < limit:
                break

            offset += limit

        return all_hosts

    def get_ports_parallel(
        self,
        storage_system_ids: List[str],
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, List[Dict]]:
        """
        Get ports for multiple storage systems in parallel.

        Args:
            storage_system_ids: List of storage system IDs
            progress_callback: Optional callback function(current, total, message)

        Returns:
            Dict mapping storage_system_id to list of ports
        """
        ports_by_system = {}
        completed = 0
        total = len(storage_system_ids)

        def fetch_ports_for_system(system_id: str) -> Tuple[str, List[Dict]]:
            """Fetch ports for a single system"""
            try:
                # Note: Adjust endpoint based on actual API documentation
                endpoint = f"storage-systems/{system_id}/ports"
                data = self._make_request(endpoint)
                ports = data.get('data', [])
                return (system_id, ports)
            except Exception as e:
                logger.warning(f"Error fetching ports for {system_id}: {e}")
                return (system_id, [])

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_system = {
                executor.submit(fetch_ports_for_system, sys_id): sys_id
                for sys_id in storage_system_ids
            }

            for future in as_completed(future_to_system):
                system_id, ports = future.result()
                ports_by_system[system_id] = ports
                completed += 1

                if progress_callback:
                    progress_callback(
                        completed,
                        total,
                        f"Fetched ports for {completed}/{total} systems ({len(ports)} ports)"
                    )

        return ports_by_system

    def get_all_data_optimized(
        self,
        storage_system_ids: Optional[List[str]] = None,
        import_options: Optional[Dict] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict:
        """
        Get all storage data with optimized parallel requests.

        Args:
            storage_system_ids: Optional list of specific system IDs to fetch
            import_options: Dict with boolean flags:
                - storage_systems: Import system info
                - volumes: Import volumes
                - hosts: Import hosts
                - ports: Import ports
            progress_callback: Optional callback function(current, total, message)

        Returns:
            Dict with keys: storage_systems, volumes_by_system, hosts_by_system, ports_by_system
        """
        if import_options is None:
            import_options = {
                'storage_systems': True,
                'volumes': True,
                'hosts': True,
                'ports': False
            }

        result = {
            'storage_systems': [],
            'volumes_by_system': {},
            'hosts_by_system': {},
            'ports_by_system': {}
        }

        # Step 1: Get storage systems
        if import_options.get('storage_systems', True):
            if progress_callback:
                progress_callback(0, 100, "Fetching storage systems...")

            if storage_system_ids:
                # Fetch specific systems
                result['storage_systems'] = [
                    self._make_request(f"storage-systems/{sys_id}")
                    for sys_id in storage_system_ids
                ]
            else:
                # Fetch all systems
                result['storage_systems'] = self.get_storage_systems()

        system_ids = storage_system_ids or [
            s.get('storage_system_id') or s.get('serial')
            for s in result['storage_systems']
        ]

        # Step 2: Get volumes in parallel
        if import_options.get('volumes', True) and system_ids:
            if progress_callback:
                progress_callback(20, 100, "Fetching volumes...")

            result['volumes_by_system'] = self.get_volumes_parallel(
                system_ids,
                progress_callback=lambda c, t, m: progress_callback(
                    20 + int(30 * c / t), 100, m
                ) if progress_callback else None
            )

        # Step 3: Get hosts in parallel
        if import_options.get('hosts', True) and system_ids:
            if progress_callback:
                progress_callback(50, 100, "Fetching hosts...")

            result['hosts_by_system'] = self.get_hosts_parallel(
                system_ids,
                progress_callback=lambda c, t, m: progress_callback(
                    50 + int(30 * c / t), 100, m
                ) if progress_callback else None
            )

        # Step 4: Get ports in parallel
        if import_options.get('ports', False) and system_ids:
            if progress_callback:
                progress_callback(80, 100, "Fetching ports...")

            result['ports_by_system'] = self.get_ports_parallel(
                system_ids,
                progress_callback=lambda c, t, m: progress_callback(
                    80 + int(20 * c / t), 100, m
                ) if progress_callback else None
            )

        if progress_callback:
            progress_callback(100, 100, "Data fetch complete!")

        return result
