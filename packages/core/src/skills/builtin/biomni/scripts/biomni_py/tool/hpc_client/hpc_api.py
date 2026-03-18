# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/hpc_api.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2089-12-26 14:25:26 UTC (3786445526)

import logging
import os
from typing import Any
from .builders import build_alphafold_command, build_boltz_command, build_chai_command, build_immunebuilder_command, build_rfantibody_command, build_thermompnn_command
from .hpc_tools import hpc_api_run
logger = logging.getLogger(__name__)
TOOL_BUILDERS = {'alphafold': build_alphafold_command, 'chai': build_chai_command, 'immunebuilder': build_immunebuilder_command, 'thermompnn': build_thermompnn_command, 'rfantibody': build_rfantibody_command, 'boltz': build_boltz_command}
TOOL_IDS = {'alphafold': 'alphafold-v2', 'chai': 'chai-1', 'immunebuilder': 'immunebuilder', 'thermompnn': 'thermompnn', 'rfantibody': 'rfantibody', 'boltz': 'boltz-2'}
def _get_results_dir() -> str:
    if os.path.exists('/mnt/results'):
        return '/mnt/results'
    else:
        if hasattr(__builtins__, '__results_dir__'):
            return __builtins__.__results_dir__
        else:
            return '/tmp/phylo-results'
def run_tool(tool_name: str, job_name: str, settings_dict: dict[str, Any], timeout_seconds: int=3600) -> str:
    if tool_name not in TOOL_BUILDERS:
        raise ValueError(f"Unsupported tool: {tool_name}. Supported: {', '.join(TOOL_BUILDERS.keys())}")
    else:
        tool_id = TOOL_IDS[tool_name]
        builder = TOOL_BUILDERS[tool_name]
        logger.info(f'Building {tool_name} command for job {job_name}')
        command, input_files = builder(settings_dict)
        logger.debug(f'Command: {command[:200]}...')
        if input_files:
            logger.debug(f'Input files: {len(input_files)}')
        results_dir = _get_results_dir()
        output_path = os.path.join(results_dir, job_name)
        os.makedirs(output_path, exist_ok=True)
        api_url = os.getenv('HPC_API_URL', '')
        hpc_token = os.getenv('HPC_TOKEN', '')
        logger.info(f'Submitting {tool_name} job {job_name} to HPC API')
        result_dir = hpc_api_run(tool_id=tool_id, command=command, output_dir=output_path, input_files=input_files, poll_interval_seconds=10, timeout_seconds=timeout_seconds, api_url=api_url, hpc_token=hpc_token)
        logger.info(f'Job {job_name} completed. Results: {result_dir}')
        return result_dir