import requests
import time
from typing import Dict, List, Optional, Tuple
from django.core.cache import cache


class StorageInsightsClient:
    """Simple API client for IBM Storage Insights"""
    
    def __init__(self, tenant_id: str, api_key: str):
        self.tenant_id = tenant_id
        self.api_key = api_key
        self.base_url = f"https://insights.ibm.com/restapi/v1/tenants/{tenant_id}"
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def _get_auth_token(self) -> str:
        """Get authentication token with simple caching"""
        cache_key = f"insights_token_{self.tenant_id}"
        token = cache.get(cache_key)
        
        if token:
            return token
        
        # Get new token using correct IBM Storage Insights API
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
    
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """Make authenticated API request with simple retry logic"""
        token = self._get_auth_token()
        headers = {'x-api-token': token, 'Accept': 'application/json'}
        
        url = f"{self.base_url}/{endpoint}"
        
        for attempt in range(2):  # Simple retry logic
            try:
                response = self.session.get(url, headers=headers, params=params, timeout=30)
                
                if response.status_code == 401 and attempt == 0:
                    # Token might be expired, clear cache and retry
                    cache.delete(f"insights_token_{self.tenant_id}")
                    token = self._get_auth_token()
                    headers['x-api-token'] = token
                    continue
                
                response.raise_for_status()
                return response.json()
                
            except requests.exceptions.RequestException as e:
                if attempt == 1:  # Last attempt
                    raise
                time.sleep(1)  # Simple backoff
    
    def get_storage_systems(self) -> List[Dict]:
        """Get all storage systems"""
        try:
            data = self._make_request("storage-systems")
            return data.get('data', [])
        except Exception as e:
            raise Exception(f"Failed to fetch storage systems: {str(e)}")
    
    def get_volumes(self, storage_system_id: str) -> List[Dict]:
        """Get volumes for a specific storage system with proper pagination"""
        try:
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
                    
                all_volumes.extend(volumes)
                
                # Check if there are more pages by looking at the response
                # If we got fewer than the limit, we've reached the end
                if len(volumes) < limit:
                    break
                    
                # Move to next page
                offset += limit
                
            return all_volumes
        except Exception as e:
            raise Exception(f"Failed to fetch volumes for {storage_system_id}: {str(e)}")
    
    def get_hosts(self, storage_system_id: str) -> List[Dict]:
        """Get hosts for a specific storage system with proper pagination"""
        try:
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
                    
                all_hosts.extend(hosts)
                
                # Check if there are more pages by looking at the response
                # If we got fewer than the limit, we've reached the end
                if len(hosts) < limit:
                    break
                    
                # Move to next page
                offset += limit
                
            return all_hosts
        except Exception as e:
            raise Exception(f"Failed to fetch hosts for {storage_system_id}: {str(e)}")
    
    def get_all_data(self) -> Tuple[List[Dict], Dict[str, List[Dict]], Dict[str, List[Dict]]]:
        """
        Get all storage data in one call
        Returns: (storage_systems, volumes_by_system, hosts_by_system)
        """
        storage_systems = self.get_storage_systems()
        volumes_by_system = {}
        hosts_by_system = {}
        
        for system in storage_systems:
            system_id = system.get('storage_system_id')  # Use correct field name
            if system_id:
                try:
                    volumes_by_system[system_id] = self.get_volumes(system_id)
                    hosts_by_system[system_id] = self.get_hosts(system_id)
                except Exception as e:
                    # Log error but continue with other systems
                    print(f"Error fetching data for system {system_id}: {e}")
                    volumes_by_system[system_id] = []
                    hosts_by_system[system_id] = []
        
        return storage_systems, volumes_by_system, hosts_by_system