# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/builders/alphafold.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2019-01-12 15:28:55 UTC (1547306935)

import tempfile
from typing import Any
def build_command(settings: dict[str, Any]) -> tuple[str, dict[str, str]]:
    sequence = settings['sequence']
    msa_mode = settings.get('msaMode', 'mmseqs2_uniref_env')
    num_models = settings.get('numModels', '1')
    num_relax = settings.get('numRelax', 0)
    random_seed = settings.get('randomSeed', 0)
    model_preset = 'multimer' if ':' in sequence else 'monomer'
    db_preset = 'full_dbs' if msa_mode == 'mmseqs2_uniref_env' else 'reduced_dbs'
    if num_relax == 0:
        models_to_relax = 'none'
    else:
        if int(num_models) == num_relax:
            models_to_relax = 'all'
        else:
            models_to_relax = 'best'
    db_params = []
    if db_preset == 'full_dbs':
        db_params = ['--bfd_database_path=/mnt/fsx/dbs/alphafold2/bfd/bfd_metaclust_clu_complete_id30_c90_final_seq.sorted_opt', '--uniref30_database_path=/mnt/fsx/dbs/alphafold2/uniref30/UniRef30_2021_03']
    else:
        db_params = ['--small_bfd_database_path=/mnt/fsx/dbs/alphafold2/small_bfd/bfd-first_non_consensus_sequences.fasta']
    cmd_parts = ['python3 /app/alphafold/run_alphafold.py', '--fasta_paths=/input/seq.fasta', '--output_dir=/output', '--data_dir=/mnt/fsx/dbs/alphafold2', '--uniref90_database_path=/mnt/fsx/dbs/alphafold2/uniref90/uniref90.fasta', '--mgnify_database_path=/mnt/fsx/dbs/alphafold2/mgnify/mgy_clusters_2022_05.fa']
    cmd_parts.extend(db_params)
    cmd_parts.extend(['--pdb70_database_path=/mnt/fsx/dbs/alphafold2/pdb70/pdb70', '--template_mmcif_dir=/mnt/fsx/dbs/alphafold2/pdb_mmcif/mmcif_files', '--obsolete_pdbs_path=/mnt/fsx/dbs/alphafold2/pdb_mmcif/obsolete.dat', '--max_template_date=2024-01-01', f'--model_preset={model_preset}', f'--db_preset={db_preset}', f'--models_to_relax={models_to_relax}', '--nouse_gpu_relax', f'--random_seed={random_seed}'])
    command = ' \\\n  '.join(cmd_parts)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.fasta', delete=False) as f:
        f.write(f'>alphafold_input\n{sequence}\n')
        fasta_path = f.name
    input_files = {'seq.fasta': fasta_path}
    return (command, input_files)