# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/hpc_tools.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2017-09-29 09:57:46 UTC (1506679066)

import base64
import logging
import os
import time
from typing import Any
import requests
logger = logging.getLogger(__name__)
class HPCAPIError(Exception):
    # return None
    pass
class HPCAPIJobError(HPCAPIError):
    # return None
    pass
class HPCAPITimeoutError(HPCAPIError):
    # return None
    pass
def _get_hpc_api_config() -> tuple[str, str]:
    use_hpc_api = os.getenv('USE_HPC_API', 'false').lower() == 'true'
    if not use_hpc_api:
        raise HPCAPIError('HPC API is not enabled. Set USE_HPC_API=true in environment.')
    else:
        api_url = os.getenv('HPC_API_URL', '')
        hpc_token = os.getenv('HPC_TOKEN', '')
        if not api_url:
            raise HPCAPIError('HPC_API_URL environment variable is not set')
        else:
            if not hpc_token:
                raise HPCAPIError('HPC_TOKEN environment variable is not set')
            else:
                return (api_url.rstrip('/'), hpc_token)
def is_hpc_enabled() -> bool:
    return os.getenv('USE_HPC_API', 'false').lower() == 'true'
def hpc_api_search_tools(query: str, api_url: str | None=None, api_token: str | None=None) -> list[dict[str, Any]]:
    if api_url is None or api_token is None:
        api_url, api_token = _get_hpc_api_config()
    headers = {'Authorization': f'Bearer {api_token}', 'Content-Type': 'application/json'}
    try:
        logger.info(f'Searching HPC API for tools matching: {query}')
        response = requests.get(f'{api_url}/v1/tools', headers=headers, params={'q': query}, timeout=30)
        response.raise_for_status()
        result = response.json()
        tools = result.get('results', [])
        logger.info(f'Found {len(tools)} matching tools')
        return tools
    except requests.RequestException as e:
        logger.error(f'Failed to search HPC API tools: {e}')
        raise HPCAPIError(f'Failed to search HPC API tools: {str(e)}') from e
def hpc_api_create_job(tool_id: str, command: str, input_files: dict[str, str] | None=None, api_url: str | None=None, hpc_token: str | None=None) -> str:
    if api_url is None or hpc_token is None:
        api_url, hpc_token = _get_hpc_api_config()
    headers = {'Authorization': f'Bearer {hpc_token}', 'Content-Type': 'application/json'}
    payload = {'tool_id': tool_id, 'command': command}
    if input_files:
        inputs = []
        for dest_filename, local_path in input_files.items():
            try:
                with open(local_path, 'rb') as f:
                    content_bytes = f.read()
                encoded_content = base64.b64encode(content_bytes).decode('utf-8')
                inputs.append({'filename': dest_filename, 'type': 'base64', 'content': encoded_content})
                logger.debug(f'Added input file: {dest_filename} (from {local_path})')
            except OSError as e:
                raise HPCAPIError(f'Failed to read input file {local_path}: {str(e)}') from e
        payload['inputs'] = inputs
        logger.debug(f'Added {len(inputs)} input files')
    try:
        logger.info(f'Creating HPC API job for tool: {tool_id}')
        logger.debug(f'Command: {command[:200]}...')
        response = requests.post(f'{api_url}/v1/jobs', headers=headers, json=payload, timeout=30)
        if not response.ok:
            try:
                err = response.json()
                error_msg = err.get('detail', str(err))
            except Exception:
                error_msg = response.text
            raise HPCAPIError(f'HPC API job creation failed ({response.status_code} {response.reason}): {error_msg}')
        else:
            result = response.json()
            job_id = result['job_id']
            logger.info(f'Created HPC API job: {job_id}')
            return job_id
    except requests.RequestException as e:
        logger.error(f'Failed to create HPC API job: {e}')
        raise HPCAPIError(f'Failed to create HPC API job: {str(e)}') from e
def hpc_api_get_job_status(job_id: str, api_url: str | None=None, hpc_token: str | None=None) -> dict[str, Any]:
    if api_url is None or hpc_token is None:
        api_url, hpc_token = _get_hpc_api_config()
    headers = {'Authorization': f'Bearer {hpc_token}'}
    try:
        response = requests.get(f'{api_url}/v1/jobs/{job_id}', headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f'Failed to get HPC API job status for {job_id}: {e}')
        raise HPCAPIError(f'Failed to get HPC API job status: {str(e)}') from e
def hpc_api_get_job_logs(job_id: str, tail: int=100, api_url: str | None=None, hpc_token: str | None=None) -> list[str]:
    if api_url is None or hpc_token is None:
        api_url, hpc_token = _get_hpc_api_config()
    headers = {'Authorization': f'Bearer {hpc_token}'}
    try:
        response = requests.get(f'{api_url}/v1/jobs/{job_id}/logs', headers=headers, params={'tail': tail}, timeout=30)
        response.raise_for_status()
        result = response.json()
        return result.get('logs', [])
    except requests.RequestException as e:
        logger.error(f'Failed to get HPC API job logs for {job_id}: {e}')
        raise HPCAPIError(f'Failed to get HPC API job logs: {str(e)}') from e
def hpc_api_cancel_job(job_id: str, api_url: str | None=None, hpc_token: str | None=None) -> dict[str, Any]:
    if api_url is None or hpc_token is None:
        api_url, hpc_token = _get_hpc_api_config()
    headers = {'Authorization': f'Bearer {hpc_token}', 'Content-Type': 'application/json'}
    try:
        logger.info(f'Cancelling HPC API job: {job_id}')
        response = requests.post(f'{api_url}/v1/jobs/{job_id}/cancel', headers=headers, timeout=30)
        if not response.ok:
            try:
                err = response.json()
                error_msg = err.get('detail', str(err))
            except Exception:
                error_msg = response.text
            raise HPCAPIError(f'HPC API job cancel failed ({response.status_code} {response.reason}): {error_msg}')
        else:
            result = response.json()
            logger.info(f'Cancelled HPC API job: {job_id}')
            return result
    except requests.RequestException as e:
        logger.error(f'Failed to cancel HPC API job {job_id}: {e}')
        raise HPCAPIError(f'Failed to cancel HPC API job: {str(e)}') from e
def hpc_api_wait_for_completion(job_id: str, poll_interval_seconds: int=10, timeout_seconds: int=3600, api_url: str | None=None, hpc_token: str | None=None, status_callback: Any | None=None) -> dict[str, Any]:
    if api_url is None or hpc_token is None:
        api_url, hpc_token = _get_hpc_api_config()
    logger.info(f'Waiting for HPC API job {job_id} to complete (timeout: {timeout_seconds}s)')
    start_time = time.time()
    last_status = None
    consecutive_errors = 0
    max_consecutive_errors = 2
    while time.time() - start_time < timeout_seconds:
        try:
            job_status = hpc_api_get_job_status(job_id, api_url, hpc_token)
            consecutive_errors = 0
            status = job_status.get('status', '').lower()
            if status!= last_status:
                logger.info(f'Job {job_id} status: {status}')
                last_status = status
                if status_callback:
                    try:
                        status_callback(job_id, status)
                    except Exception as e:
                        logger.warning(f'Status callback failed: {e}')
            if status == 'completed':
                elapsed = time.time() - start_time
                logger.info(f'Job {job_id} completed successfully in {elapsed:.1f}s')
                return job_status
            else:
                if status == 'failed':
                    error_msg = f'HPC API job {job_id} failed'
                    logs_content = job_status.get('logs')
                    if logs_content:
                        error_msg += f'\n\nTask logs:\n{logs_content}'
                    raise HPCAPIJobError(error_msg)
                else:
                    time.sleep(poll_interval_seconds)
        except (HPCAPIJobError, HPCAPITimeoutError):
            raise
        except HPCAPIError as e:
            consecutive_errors += 1
            logger.warning(f'Error getting job status (attempt {consecutive_errors}/{max_consecutive_errors}): {e}')
            if consecutive_errors >= max_consecutive_errors:
                raise HPCAPIError(f'Failed to get job status after {max_consecutive_errors} attempts: {str(e)}') from e
            else:
                time.sleep(poll_interval_seconds)
    raise HPCAPITimeoutError(f"HPC API job {job_id} did not complete within {timeout_seconds} seconds. Last status: {last_status or 'unknown'}")
def hpc_api_get_results(job_id: str, output_dir: str, api_url: str | None=None, hpc_token: str | None=None) -> str:
    if api_url is None or hpc_token is None:
        api_url, hpc_token = _get_hpc_api_config()
    headers = {'Authorization': f'Bearer {hpc_token}'}
    try:
        logger.info(f'Retrieving results for HPC API job {job_id}')
        response = requests.get(f'{api_url}/v1/jobs/{job_id}/results', headers=headers, timeout=30)
        if response.status_code == 425:
            raise HPCAPIError(f'Job {job_id} is not completed yet')
        else:
            response.raise_for_status()
            results = response.json()
            os.makedirs(output_dir, exist_ok=True)
            files = results.get('files', {})
            logger.info(f'Downloading {len(files)} result files to {output_dir}')
            for filename, file_info in files.items():
                file_path = os.path.join(output_dir, filename)
                logger.debug(f'Downloading {filename}...')
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                if file_info.get('type') == 'url':
                    file_response = requests.get(file_info['url'], timeout=300)
                    file_response.raise_for_status()
                    with open(file_path, 'wb') as f:
                        f.write(file_response.content)
                else:
                    if file_info.get('type') == 'base64':
                        content = base64.b64decode(file_info['content'])
                        with open(file_path, 'wb') as f:
                            f.write(content)
                    else:
                        logger.warning(f"Unknown file type for {filename}: {file_info.get('type')}")
            logger.info(f'Downloaded {len(files)} files successfully to {output_dir}')
            return output_dir
    except requests.RequestException as e:
        logger.error(f'Failed to download HPC API job results: {e}')
        raise HPCAPIError(f'Failed to download HPC API job results: {str(e)}') from e
def hpc_api_run(tool_id: str, command: str, output_dir: str, input_files: dict[str, str] | None=None, poll_interval_seconds: int=10, timeout_seconds: int=3600, api_url: str | None=None, hpc_token: str | None=None) -> str:
    logger.info(f'Running HPC API tool: {tool_id}')
    job_id = hpc_api_create_job(tool_id, command, input_files, api_url, hpc_token)
    hpc_api_wait_for_completion(job_id, poll_interval_seconds, timeout_seconds, api_url, hpc_token)
    return hpc_api_get_results(job_id, output_dir, api_url, hpc_token)