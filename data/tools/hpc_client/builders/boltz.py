# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/builders/boltz.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2004-03-12 04:05:08 UTC (1079064308)

import tempfile
from typing import Any
import yaml
def build_command(settings: dict[str, Any]) -> tuple[str, dict[str, str]]:
    sequence = settings.get('sequence', '')
    use_msa = settings.get('useMSA', True)
    input_yaml = {'version': 1, 'sequences': []}
    if ':' in str(sequence):
        chains = sequence.split(':')
        for i, chain_seq in enumerate(chains):
            protein_entry = {'id': chr(65 + i), 'sequence': chain_seq}
            if not use_msa:
                protein_entry['msa'] = 'empty'
            input_yaml['sequences'].append({'protein': protein_entry})
    else:
        protein_entry = {'id': 'A', 'sequence': sequence}
        if not use_msa:
            protein_entry['msa'] = 'empty'
        input_yaml['sequences'].append({'protein': protein_entry})
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        yaml.dump(input_yaml, f)
        yaml_path = f.name
    cmd_parts = ['HF_HUB_OFFLINE=1 boltz predict /input/input.yaml --out_dir /output --cache /mnt/fsx/dbs/boltz/cache']
    if use_msa:
        cmd_parts.append('--use_msa_server')
    command = ' '.join(cmd_parts)
    input_files = {'input.yaml': yaml_path}
    return (command, input_files)