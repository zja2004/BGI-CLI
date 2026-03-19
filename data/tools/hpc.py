# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2089-02-03 23:32:17 UTC (3758311937)

import logging
import os
from typing import Any
from .hpc_client.hpc_tools import HPCAPIError, hpc_api_cancel_job, hpc_api_create_job, hpc_api_get_job_logs, hpc_api_get_job_status, hpc_api_get_results, hpc_api_search_tools, hpc_api_wait_for_completion, is_hpc_enabled
logger = logging.getLogger(__name__)
def _get_results_dir() -> str:
    if os.path.exists('/mnt/results'):
        return '/mnt/results'
    else:
        import tempfile
        return tempfile.gettempdir()
def hpc_search_tools(query: str) -> list[dict[str, Any]]:
    if not is_hpc_enabled():
        raise HPCAPIError('HPC API is not enabled. Set USE_HPC_API=true in environment.')
    else:
        logger.info(f'Searching HPC tools for: {query}')
        results = hpc_api_search_tools(query)
        logger.info(f'Found {len(results)} matching tools')
        return results
def hpc_run_tool(tool_id: str, command: str, input_files: dict[str, str] | None=None) -> dict[str, Any]:
    if not is_hpc_enabled():
        raise HPCAPIError('HPC API is not enabled. Set USE_HPC_API=true in environment.')
    else:
        logger.info(f'Running HPC tool: {tool_id}')
        logger.debug(f'Command: {command[:200]}...')
        job_id = hpc_api_create_job(tool_id=tool_id, command=command, input_files=input_files)
        job_status = hpc_api_get_job_status(job_id)
        logger.info(f'Job created: {job_id}')
        return job_status
def hpc_get_job_results(job_id: str, poll: bool=True, timeout: int=3600, poll_interval: int=10, status_callback: Any | None=None) -> dict[str, Any]:
    if not is_hpc_enabled():
        raise HPCAPIError('HPC API is not enabled. Set USE_HPC_API=true in environment.')
    else:
        logger.info(f'Getting results for job: {job_id} (poll={poll})')
        if not poll:
            return hpc_api_get_job_status(job_id)
        else:
            job_status = hpc_api_wait_for_completion(job_id=job_id, poll_interval_seconds=poll_interval, timeout_seconds=timeout, status_callback=status_callback)
            results_dir = _get_results_dir()
            output_dir = os.path.join(results_dir, f'hpc_{job_id}')
            try:
                hpc_api_get_results(job_id, output_dir)
                files = {}
                if os.path.exists(output_dir):
                    for root, dirs, filenames in os.walk(output_dir):
                        for filename in filenames:
                            full_path = os.path.join(root, filename)
                            rel_path = os.path.relpath(full_path, output_dir)
                            files[rel_path] = full_path
                logger.info(f'Downloaded {len(files)} result files to {output_dir}')
                return {**job_status, 'files': files, 'output_dir': output_dir}
            except HPCAPIError as e:
                logger.error(f'Failed to download results: {e}')
                return {**job_status, 'error': str(e)}
def hpc_get_logs(job_id: str, tail: int=100) -> list[str]:
    logger.info(f'Getting logs for job: {job_id} (tail={tail})')
    return hpc_api_get_job_logs(job_id, tail=tail)
def hpc_cancel_job(job_id: str) -> dict[str, Any]:
    if not is_hpc_enabled():
        raise HPCAPIError('HPC API is not enabled. Set USE_HPC_API=true in environment.')
    else:
        logger.info(f'Cancelling job: {job_id}')
        return hpc_api_cancel_job(job_id)
def hpc_run_and_wait(tool_id: str, command: str, input_files: dict[str, str] | None=None, timeout: int=3600, poll_interval: int=10, status_callback: Any | None=None) -> dict[str, Any]:
    job = hpc_run_tool(tool_id=tool_id, command=command, input_files=input_files)
    return hpc_get_job_results(job_id=job['job_id'], poll=True, timeout=timeout, poll_interval=poll_interval, status_callback=status_callback)