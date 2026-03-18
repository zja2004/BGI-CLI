# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/integrations/_api_internal.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2055-06-18 02:19:48 UTC (2696897988)

import os
from typing import Any
import requests
def _get_auth() -> tuple[str, dict[str, str]]:
    token = os.environ.get('EXTERNAL_API_TOKEN')
    backend_url = os.environ.get('BACKEND_URL')
    if not token:
        raise RuntimeError('EXTERNAL_API_TOKEN environment variable not set. This token is required for API access.')
    else:
        if not backend_url:
            raise RuntimeError('BACKEND_URL environment variable not set. This is required to reach the API.')
        else:
            return (backend_url, {'Authorization': f'Bearer {token}'})
def _make_proxy_request(proxy_path: str, method: str, path: str, params: dict | None=None, json_data: dict | None=None, timeout: int=60) -> dict[str, Any]:
    backend_url, headers = _get_auth()
    url = f'{backend_url}{proxy_path}/{path}'
    response = requests.request(method=method, url=url, headers=headers, params=params, json=json_data, timeout=timeout)
    if not response.ok:
        try:
            error_detail = response.json()
        except Exception:
            error_detail = response.text or response.reason
        raise requests.HTTPError(f'{response.status_code} {response.reason}: {error_detail}', response=response)
    else:
        if response.status_code == 204 or not response.content:
            return {}
        else:
            return response.json()