# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/hpc_client/builders/rfantibody.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2083-08-07 03:21:21 UTC (3584834481)

from typing import Any
def _build_design_loops(settings: dict[str, Any]) -> str:
    if settings.get('selectCDRIndices', False):
        loops = []
        cdr_map = {'L1': settings.get('lcdr1Residues'), 'L2': settings.get('lcdr2Residues'), 'L3': settings.get('lcdr3Residues'), 'H1': settings.get('hcdr1Residues'), 'H2': settings.get('hcdr2Residues'), 'H3': settings.get('hcdr3Residues')}
        for cdr_name, residues in cdr_map.items():
            if residues:
                loops.append(f'{cdr_name}:{residues}')
        if loops:
            return ','.join(loops)
    cdr_lengths = {'L1': settings.get('lcdr1Length', 'auto'), 'L2': settings.get('lcdr2Length', 'auto'), 'L3': settings.get('lcdr3Length', 'auto'), 'H1': settings.get('hcdr1Length', 'auto'), 'H2': settings.get('hcdr2Length', 'auto'), 'H3': settings.get('hcdr3Length', 'auto')}
    default_ranges = {'L1': '8-13', 'L2': '7', 'L3': '9-11', 'H1': '7', 'H2': '6', 'H3': '5-13'}
    loops = []
    for cdr_name, length in cdr_lengths.items():
        if length == 'auto':
            loops.append(f'{cdr_name}:{default_ranges[cdr_name]}')
        else:
            loops.append(f'{cdr_name}:{length}')
    return ','.join(loops)
def _get_framework_path(settings: dict[str, Any]) -> tuple[str | None, bool]:
    framework = settings.get('framework', 'custom')
    if framework == 'custom':
        antibody_file = settings.get('antibodyFile')
        if not antibody_file:
            raise ValueError('antibodyFile is required when framework=\'custom\'')
        else:
            return (antibody_file, False)
    else:
        if framework == 'h-NbBCII10':
            return ('/home/scripts/examples/example_inputs/h-NbBCII10.pdb', True)
        else:
            if framework == 'hu-4D5-8_Fv':
                return ('/home/scripts/examples/example_inputs/hu-4D5-8_Fv.pdb', True)
            else:
                raise ValueError(f'Unknown framework: {framework}. Must be \'custom\', \'h-NbBCII10\', or \'hu-4D5-8_Fv\'')
def build_command(settings: dict[str, Any]) -> tuple[str, dict[str, str]]:
    target_file = settings.get('targetFile')
    if not target_file:
        raise ValueError('targetFile is required')
    else:
        framework_path, is_preset = _get_framework_path(settings)
        hotspots_str = settings.get('hotspots', '')
        if not hotspots_str:
            hotspots_str = 'T305,T456'
        design_loops = _build_design_loops(settings)
        num_designs = settings.get('numDesigns', 20)
        if is_preset:
            command = f'cd /home && poetry run python scripts/rfdiffusion_inference.py --config-name antibody antibody.target_pdb=/input/target.pdb antibody.framework_pdb={framework_path} inference.ckpt_override_path=/mnt/fsx/dbs/rfantibody/RFdiffusion_Ab.pt \'ppi.hotspot_res=[{hotspots_str}]\' \'antibody.design_loops=[{design_loops}]\' inference.num_designs={num_designs} inference.output_prefix=/output/design'
            input_files = {'target.pdb': target_file}
        else:
            command = f'cd /home && poetry run python scripts/rfdiffusion_inference.py --config-name antibody antibody.target_pdb=/input/target.pdb antibody.framework_pdb=/input/framework.pdb inference.ckpt_override_path=/mnt/fsx/dbs/rfantibody/RFdiffusion_Ab.pt \'ppi.hotspot_res=[{hotspots_str}]\' \'antibody.design_loops=[{design_loops}]\' inference.num_designs={num_designs} inference.output_prefix=/output/design'
            input_files = {'target.pdb': target_file, 'framework.pdb': framework_path}
        return (command, input_files)