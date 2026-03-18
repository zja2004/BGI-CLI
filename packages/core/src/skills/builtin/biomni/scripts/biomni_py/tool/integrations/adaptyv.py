# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/integrations/adaptyv.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2068-12-27 05:04:37 UTC (3123810277)

from typing import Any, Literal
from ._api_internal import _make_proxy_request
_PROXY_PATH = '/v1/proxy/adaptyv'
def _make_request(method: str, path: str, params: dict | None=None, json_data: dict | None=None, timeout: int=60) -> dict[str, Any]:
    return _make_proxy_request(_PROXY_PATH, method, path, params, json_data, timeout)
__all__ = ['list_targets', 'get_target', 'estimate_cost', 'create_experiment', 'get_experiment', 'get_quote', 'confirm_experiment', 'get_invoice', 'list_experiment_updates', 'list_experiment_results', 'get_result', 'list_experiment_sequences', 'list_sequences', 'get_sequence', 'add_sequences_to_experiment']
def list_targets(*, limit: int=50, offset: int=0, selfservice_only: bool=True, search: str | None=None) -> dict[str, Any]:
    params = {'limit': limit, 'offset': offset}
    if selfservice_only:
        params['selfservice_only'] = 'true'
    if search:
        params['search'] = search
    return _make_request('GET', 'targets', params=params)
def get_target(target_id: str) -> dict[str, Any]:
    return _make_request('GET', f'targets/{target_id}')
def estimate_cost(experiment_type: Literal['expression', 'screening', 'affinity', 'thermostability', 'fluorescence'], sequences: dict[str, str | dict], *, target_id: str | None=None, method: Literal['bli', 'spr'] | None=None, n_replicates: int=3, antigen_concentrations: list[float] | None=None) -> dict[str, Any]:
    experiment_spec = {'experiment_type': experiment_type, 'n_replicates': n_replicates}
    formatted_sequences = {}
    for seq_name, seq in sequences.items():
        if isinstance(seq, str):
            formatted_sequences[seq_name] = {'aa_string': seq}
        else:
            formatted_sequences[seq_name] = seq
    experiment_spec['sequences'] = formatted_sequences
    if experiment_type in ['screening', 'affinity']:
        if not target_id:
            raise ValueError(f'target_id is required for {experiment_type} experiments')
        else:
            if not method:
                raise ValueError(f'method (bli/spr) is required for {experiment_type} experiments')
            else:
                experiment_spec['target_id'] = target_id
                experiment_spec['method'] = method
    if experiment_type == 'affinity':
        if not antigen_concentrations:
            raise ValueError('antigen_concentrations is required for affinity experiments')
        else:
            experiment_spec['antigen_concentrations'] = antigen_concentrations
    payload = {'experiment_spec': experiment_spec}
    return _make_request('POST', 'experiments/costestimate', json_data=payload)
def create_experiment(name: str, experiment_type: Literal['expression', 'screening', 'affinity', 'thermostability', 'fluorescence'], sequences: dict[str, str | dict], *, target_id: str | None=None, method: Literal['bli', 'spr'] | None=None, n_replicates: int=3, antigen_concentrations: list[float] | None=None, webhook_url: str | None=None) -> dict[str, Any]:
    experiment_spec = {'experiment_type': experiment_type, 'n_replicates': n_replicates}
    formatted_sequences = {}
    for seq_name, seq in sequences.items():
        if isinstance(seq, str):
            formatted_sequences[seq_name] = {'aa_string': seq}
        else:
            formatted_sequences[seq_name] = seq
    experiment_spec['sequences'] = formatted_sequences
    if experiment_type in ['screening', 'affinity']:
        if not target_id:
            raise ValueError(f'target_id is required for {experiment_type} experiments')
        else:
            if not method:
                raise ValueError(f'method (bli/spr) is required for {experiment_type} experiments')
            else:
                experiment_spec['target_id'] = target_id
                experiment_spec['method'] = method
    if experiment_type == 'affinity':
        if not antigen_concentrations:
            raise ValueError('antigen_concentrations is required for affinity experiments')
        else:
            experiment_spec['antigen_concentrations'] = antigen_concentrations
    payload = {'name': name, 'experiment_spec': experiment_spec, 'skip_draft': False}
    if webhook_url:
        payload['webhook_url'] = webhook_url
    return _make_request('POST', 'experiments', json_data=payload)
def get_experiment(experiment_id: str) -> dict[str, Any]:
    return _make_request('GET', f'experiments/{experiment_id}')
def get_quote(experiment_id: str) -> dict[str, Any]:
    return _make_request('GET', f'experiments/{experiment_id}/quote')
def confirm_experiment(experiment_id: str) -> dict[str, Any]:
    return _make_request('POST', f'experiments/{experiment_id}/confirm')
def get_invoice(experiment_id: str) -> dict[str, Any]:
    return _make_request('GET', f'experiments/{experiment_id}/invoice')
def list_experiment_updates(experiment_id: str, *, limit: int=50, offset: int=0) -> dict[str, Any]:
    params = {'limit': limit, 'offset': offset}
    return _make_request('GET', f'experiments/{experiment_id}/updates', params=params)
def list_experiment_results(experiment_id: str, *, limit: int=50, offset: int=0) -> dict[str, Any]:
    params = {'limit': limit, 'offset': offset}
    return _make_request('GET', f'experiments/{experiment_id}/results', params=params)
def get_result(result_id: str) -> dict[str, Any]:
    return _make_request('GET', f'results/{result_id}')
def list_experiment_sequences(experiment_id: str, *, limit: int=50, offset: int=0) -> dict[str, Any]:
    params = {'limit': limit, 'offset': offset}
    return _make_request('GET', f'experiments/{experiment_id}/sequences', params=params)
def list_sequences(experiment_id: str, *, limit: int=50, offset: int=0, search: str | None=None) -> dict[str, Any]:
    params = {'experiment_id': experiment_id, 'limit': limit, 'offset': offset}
    if search:
        params['search'] = search
    return _make_request('GET', 'sequences', params=params)
def get_sequence(sequence_id: str) -> dict[str, Any]:
    return _make_request('GET', f'sequences/{sequence_id}')
def add_sequences_to_experiment(experiment_code: str, sequences: dict[str, str | dict]) -> dict[str, Any]:
    formatted_sequences = {}
    for name, seq in sequences.items():
        if isinstance(seq, str):
            formatted_sequences[name] = {'aa_string': seq}
        else:
            formatted_sequences[name] = seq
    payload = {'sequences': formatted_sequences}
    return _make_request('POST', f'experiments/{experiment_code}/sequences', json_data=payload)