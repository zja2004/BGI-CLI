# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/pharmacology.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2034-08-20 04:57:05 UTC (2039662625)

import subprocess
import sys
def predict_admet_properties(smiles_list, ADMET_model_type='MPNN'):
    try:
        from DeepPurpose import CompoundPred, utils
    except Exception:
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'DeepPurpose'], check=False)
        from DeepPurpose import CompoundPred, utils
    available_model_types = ['MPNN', 'CNN', 'Morgan']
    if ADMET_model_type not in available_model_types:
        return f"Error: Invalid ADMET model type \'{ADMET_model_type}\'. Available options are: {', '.join(available_model_types)}."
    else:
        model_ADMETs = {}
        tasks = ['AqSolDB', 'Caco2', 'HIA', 'Pgp_inhibitor', 'Bioavailability', 'BBB_MolNet', 'PPBR', 'CYP2C19', 'CYP2D6', 'CYP3A4', 'CYP1A2', 'CYP2C9', 'ClinTox', 'Lipo_AZ', 'Half_life_eDrug3D', 'Clearance_eDrug3D']
        for task in tasks:
            model_ADMETs[task + '_' + ADMET_model_type + '_model'] = CompoundPred.model_pretrained(model=task + '_' + ADMET_model_type + '_model')
        def ADMET_pred(drug, task, unit):
            model = model_ADMETs[task + '_' + ADMET_model_type + '_model']
            X_pred = utils.data_process(X_drug=[drug], y=[0], drug_encoding=ADMET_model_type, split_method='no_split')
            y_pred = model.predict(X_pred)[0]
            if unit == '%':
                y_pred = y_pred * 100
            return f'{y_pred:.2f} ' + unit
        research_log = 'Research Log for ADMET Predictions:\n'
        research_log += '-------------------------------------\n'
        for smiles in smiles_list:
            research_log += f'\nCompound SMILES: {smiles}\n'
            research_log += 'Predicted ADMET properties:\n'
            solubility = ADMET_pred(smiles, 'AqSolDB', 'log mol/L')
            lipophilicity = ADMET_pred(smiles, 'Lipo_AZ', '(log-ratio)')
            research_log += f'- Solubility: {solubility}\n'
            research_log += f'- Lipophilicity: {lipophilicity}\n'
            caco2 = ADMET_pred(smiles, 'Caco2', 'cm/s')
            hia = ADMET_pred(smiles, 'HIA', '%')
            pgp = ADMET_pred(smiles, 'Pgp_inhibitor', '%')
            bioavail = ADMET_pred(smiles, 'Bioavailability', '%')
            research_log += f'- Absorption (Caco-2 permeability): {caco2}\n'
            research_log += f'- Absorption (HIA): {hia}\n'
            research_log += f'- Absorption (Pgp Inhibitor): {pgp}\n'
            research_log += f'- Absorption (Bioavailability): {bioavail}\n'
            bbb = ADMET_pred(smiles, 'BBB_MolNet', '%')
            ppbr = ADMET_pred(smiles, 'PPBR', '%')
            research_log += f'- Distribution (BBB permeation): {bbb}\n'
            research_log += f'- Distribution (PPBR): {ppbr}\n'
            cyp2c19 = ADMET_pred(smiles, 'CYP2C19', '%')
            cyp2d6 = ADMET_pred(smiles, 'CYP2D6', '%')
            cyp3a4 = ADMET_pred(smiles, 'CYP3A4', '%')
            cyp1a2 = ADMET_pred(smiles, 'CYP1A2', '%')
            cyp2c9 = ADMET_pred(smiles, 'CYP2C9', '%')
            research_log += f'- Metabolism (CYP2C19): {cyp2c19}\n'
            research_log += f'- Metabolism (CYP2D6): {cyp2d6}\n'
            research_log += f'- Metabolism (CYP3A4): {cyp3a4}\n'
            research_log += f'- Metabolism (CYP1A2): {cyp1a2}\n'
            research_log += f'- Metabolism (CYP2C9): {cyp2c9}\n'
            half_life = ADMET_pred(smiles, 'Half_life_eDrug3D', 'h')
            clearance = ADMET_pred(smiles, 'Clearance_eDrug3D', 'mL/min/kg')
            research_log += f'- Excretion (Half-life): {half_life}\n'
            research_log += f'- Excretion (Clearance): {clearance}\n'
            clinical_toxicity = ADMET_pred(smiles, 'ClinTox', '%')
            research_log += f'- Clinical Toxicity: {clinical_toxicity}\n'
            research_log += '-------------------------------------\n'
        return research_log