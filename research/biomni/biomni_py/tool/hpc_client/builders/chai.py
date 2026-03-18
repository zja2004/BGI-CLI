# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/builders/chai.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2052-11-17 20:42:14 UTC (2615488934)

import tempfile
from typing import Any
def build_command(settings: dict[str, Any]) -> tuple[str, dict[str, str]]:
    sequence = settings.get('sequence') or settings.get('molecules', [])
    if isinstance(sequence, list):
        sequence = '\n'.join((f'>protein|chain_{i}\n{seq}' for i, seq in enumerate(sequence)))
    else:
        if ':' in str(sequence):
            chains = sequence.split(':')
            sequence = '\n'.join((f'>protein|chain_{i}\n{chain}' for i, chain in enumerate(chains)))
        else:
            sequence = f'>protein|name=sequence\n{sequence}'
    use_msa = settings.get('useMSA', True)
    num_samples = settings.get('numSamples', 5)
    num_recycles = settings.get('numRecycles', 3)
    seed = settings.get('seed', 42)
    cmd_parts = ['chai-lab fold /input/sequence.fasta /output', f'--num-diffn-samples {num_samples}', f'--num-trunk-recycles {num_recycles}', '--num-diffn-timesteps 200', f'--seed {seed}']
    if use_msa:
        cmd_parts.append('--use-msa-server')
    command = ' '.join(cmd_parts)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.fasta', delete=False) as f:
        f.write(sequence)
        fasta_path = f.name
    input_files = {'sequence.fasta': fasta_path}
    return (command, input_files)