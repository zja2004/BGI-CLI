# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/builders/immunebuilder.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2098-01-04 01:35:54 UTC (4039637754)

import tempfile
from typing import Any
def build_command(settings: dict[str, Any]) -> tuple[str, dict[str, str]]:
    sequence1 = settings['sequence1']
    sequence2 = settings.get('sequence2', '')
    model_type = settings.get('modelType', 'Antibody')
    cmd_map = {'Antibody': 'ABodyBuilder2', 'Nanobody': 'NanoBodyBuilder2', 'TCR': 'TCRBuilder2'}
    filename_map = {'Antibody': 'antibody', 'Nanobody': 'nanobody', 'TCR': 'tcr'}
    if model_type == 'Antibody':
        fasta_content = f'>H\n{sequence1}\n>L\n{sequence2}\n'
    else:
        if model_type == 'Nanobody':
            fasta_content = f'>H\n{sequence1}\n'
        else:
            if model_type == 'TCR':
                fasta_content = f'>A\n{sequence1}\n>B\n{sequence2}\n'
            else:
                raise ValueError(f'Unsupported modelType: {model_type}')
    builder_cmd = cmd_map[model_type]
    base_name = filename_map[model_type]
    command = f'{builder_cmd} --fasta_file /input/{base_name}.fasta -o /output/{base_name}.pdb -v'
    with tempfile.NamedTemporaryFile(mode='w', suffix='.fasta', delete=False) as f:
        f.write(fasta_content)
        fasta_path = f.name
    input_files = {f'{base_name}.fasta': fasta_path}
    return (command, input_files)