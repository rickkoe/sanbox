import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from django.conf import settings
from django.core.cache import cache
from .models import APICredentials, ImportLog
import logging

logger = logging.getLogger(__name__)


class StorageInsightsAPIClient:
    """IBM Storage Insights REST API Client"""
    
    def __init__(self, credentials: APICredentials):
        self.credentials = credentials
        self.base_url = credentials.base_url.rstrip('/')
        self.session = requests.Session()
        self.token = None
        self.token_expires = None
        
        # Rate limiting
        self.rate_limit_delay = 0.5  # seconds between requests
        self.last_request_time = 0
        
    def _get_cache_key(self, key_type: str) -> str:
        """Generate cache key for tokens/data"""
        return f"storage_insights_{self.credentials.id}_{key_type}"
    
    def authenticate(self) -> bool:
        """Authenticate with IBM Storage Insights API using the correct method"""
        cache_key = self._get_cache_key('token')
        cached_token = cache.get(cache_key)
        
        if cached_token:
            self.token = cached_token['token']
            self.token_expires = datetime.fromisoformat(cached_token['expires'])
            if datetime.now() < self.token_expires:
                self.session.headers.update({'x-api-token': self.token})
                return True
        
        # Get new token using IBM Storage Insights method
        # The tenant_id is the username, and password is the API key
        tenant = self.credentials.tenant_id or self.credentials.username
        api_key = self.credentials.password
        
        token_endpoint = f"https://insights.ibm.com/restapi/v1/tenants/{tenant}/token"
        
        headers = {
            "x-api-key": api_key,
            "Accept": "application/json"
        }
        
        try:
            response = requests.post(token_endpoint, headers=headers, timeout=30)
            print(f"DEBUG - Token request to: {token_endpoint}")
            print(f"DEBUG - Headers: {headers}")
            print(f"DEBUG - Response status: {response.status_code}")
            print(f"DEBUG - Response content: {response.text[:500]}")
            response.raise_for_status()
            
            token_data = response.json()
            
            if 'result' in token_data and 'token' in token_data['result']:
                self.token = token_data['result']['token']
                # IBM returns expiration as timestamp in milliseconds
                expiration_ms = token_data['result'].get('expiration', 0)
                self.token_expires = datetime.utcfromtimestamp(expiration_ms / 1000.0)
                
                # Cache the token (with 5 minute buffer)
                expires_in = int((self.token_expires - datetime.utcnow()).total_seconds()) - 300
                if expires_in > 0:
                    cache.set(cache_key, {
                        'token': self.token,
                        'expires': self.token_expires.isoformat()
                    }, timeout=expires_in)
                
                # Update session headers for IBM Storage Insights
                self.session.headers.update({
                    'x-api-token': self.token,
                    'Accept': 'application/json'
                })
                
                logger.info(f"Successfully authenticated with Storage Insights API")
                return True
            else:
                logger.error(f"Invalid token response: {token_data}")
                return False
            
        except requests.RequestException as e:
            logger.error(f"Authentication failed: {str(e)}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response content: {e.response.text}")
                print(f"DEBUG - Auth failed: {e.response.status_code} - {e.response.text}")
            else:
                print(f"DEBUG - Auth failed: {str(e)}")
            return False
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[Dict]:
        """Make authenticated API request with rate limiting"""
        if not self.token or datetime.utcnow() >= self.token_expires:
            if not self.authenticate():
                return None
        
        # Rate limiting
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - time_since_last)
        
        # Build the correct IBM Storage Insights URL
        url = f"https://insights.ibm.com/restapi/v1/{endpoint.lstrip('/')}"
        
        print(f"DEBUG - Making request to: {url}")
        print(f"DEBUG - Method: {method}")
        print(f"DEBUG - Headers: {dict(self.session.headers)}")
        
        try:
            response = self.session.request(method, url, timeout=60, **kwargs)
            self.last_request_time = time.time()
            
            print(f"DEBUG - Response status: {response.status_code}")
            print(f"DEBUG - Response content: {response.text[:200]}")
            
            if response.status_code == 401:  # Token expired
                if self.authenticate():
                    response = self.session.request(method, url, timeout=60, **kwargs)
                else:
                    return None
            
            response.raise_for_status()
            return response.json() if response.content else {}
            
        except requests.RequestException as e:
            logger.error(f"API request failed: {method} {url} - {str(e)}")
            print(f"DEBUG - Request failed: {str(e)}")
            return None
    
    def get_storage_systems(self, limit: int = None, offset: int = None) -> Optional[Dict]:
        """Get storage systems from Storage Insights"""
        # Use the correct IBM Storage Insights endpoint format
        tenant = self.credentials.tenant_id or self.credentials.username
        endpoint = f"tenants/{tenant}/storage-systems"
        
        # IBM Storage Insights doesn't use limit/offset for storage-systems endpoint
        # Just call without parameters like your existing working code
        return self._make_request('GET', endpoint)
    
    def get_storage_system(self, system_id: str) -> Optional[Dict]:
        """Get specific storage system details"""
        return self._make_request('GET', f'/api/v1/storage-systems/{system_id}')
    
    def get_volumes(self, system_id: str = None, limit: int = 100, offset: int = 0) -> Optional[Dict]:
        """Get volumes, optionally filtered by storage system"""
        params = {'limit': limit, 'offset': offset}
        endpoint = '/api/v1/volumes'
        
        if system_id:
            params['storage_system_id'] = system_id
            
        return self._make_request('GET', endpoint, params=params)
    
    def get_hosts(self, system_id: str = None, limit: int = 100, offset: int = 0) -> Optional[Dict]:
        """Get hosts, optionally filtered by storage system"""
        params = {'limit': limit, 'offset': offset}
        endpoint = '/api/v1/hosts'
        
        if system_id:
            params['storage_system_id'] = system_id
            
        return self._make_request('GET', endpoint, params=params)
    
    def get_pools(self, system_id: str = None, limit: int = 100, offset: int = 0) -> Optional[Dict]:
        """Get storage pools"""
        params = {'limit': limit, 'offset': offset}
        endpoint = '/api/v1/pools'
        
        if system_id:
            params['storage_system_id'] = system_id
            
        return self._make_request('GET', endpoint, params=params)
    
    def get_fabric_data(self, limit: int = 100, offset: int = 0) -> Optional[Dict]:
        """Get SAN fabric information"""
        params = {'limit': limit, 'offset': offset}
        return self._make_request('GET', '/api/v1/san-fabric', params=params)
    
    def get_performance_data(self, system_id: str, metric_type: str = 'throughput', 
                           start_time: str = None, end_time: str = None) -> Optional[Dict]:
        """Get performance metrics"""
        params = {
            'metric_type': metric_type,
            'start_time': start_time or (datetime.now() - timedelta(hours=24)).isoformat(),
            'end_time': end_time or datetime.now().isoformat()
        }
        return self._make_request('GET', f'/api/v1/storage-systems/{system_id}/metrics', params=params)
    
    def paginate_all(self, fetch_func, **kwargs) -> List[Dict]:
        """Helper to paginate through all results"""
        all_results = []
        offset = 0
        limit = kwargs.get('limit', 100)
        
        while True:
            kwargs.update({'offset': offset, 'limit': limit})
            response = fetch_func(**kwargs)
            
            if not response or 'data' not in response:
                break
                
            data = response['data']
            if not data:
                break
                
            all_results.extend(data)
            
            # Check if we have more data
            total = response.get('total', len(data))
            if offset + limit >= total:
                break
                
            offset += limit
            
        return all_results
    
    def test_connection(self) -> bool:
        """Test API connection and authentication"""
        try:
            if not self.authenticate():
                return False
            
            # Try a simple API call using the correct endpoint without parameters
            tenant = self.credentials.tenant_id or self.credentials.username
            response = self._make_request('GET', f'tenants/{tenant}/storage-systems')
            return response is not None
            
        except Exception as e:
            logger.error(f"Connection test failed: {str(e)}")
            print(f"DEBUG - Connection test failed: {str(e)}")
            return False