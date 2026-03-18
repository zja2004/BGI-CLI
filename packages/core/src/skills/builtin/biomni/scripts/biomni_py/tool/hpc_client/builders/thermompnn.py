# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/builders/thermompnn.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2091-03-24 21:19:49 UTC (3825609589)

from typing import Any
def build_command(settings: dict[str, Any]) -> tuple[str, dict[str, str]]:
    pdb_file = settings['pdbFile']
    all_chains = settings.get('allChains', False)
    chains = settings.get('chains', [])
    command = 'python /home/analysis/custom_inference.py --pdb /input/protein.pdb --model_path /home/models/thermoMPNN_default.pt --out_dir /output'
    if not all_chains and chains:
            chain_id = chains[0] if len(chains) == 1 else 'A'
            command += f' --chain {chain_id}'
    input_files = {'protein.pdb': pdb_file}
    return (command, input_files)