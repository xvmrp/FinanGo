"""Reads only the historical Falabella PDF layout verified by balance reconciliation.
Install: python -m pip install -r scripts/requirements.txt
Input PDF bytes on stdin; output JSON. No files or credentials are retained.
"""
import sys, io, re, json, hashlib, calendar
from datetime import datetime
import pdfplumber
MONTHS = {'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12}
def parse(data):
 with pdfplumber.open(io.BytesIO(data)) as pdf:
  if not 1 <= len(pdf.pages) <= 40: raise ValueError('Cantidad de páginas no admitida.')
  text=pdf.pages[0].extract_text() or ''
  account=re.search(r'Cuenta\s+([\d-]+)\s+Tipo de\s+(\w+)\s+(\d{4})',text)
  if not account or 'Cuenta Corriente / Cartola' not in text: raise ValueError('Formato de cartola histórica Falabella no reconocido.')
  number,month,year=account.groups(); year=int(year); month=MONTHS[month.lower()]
  period=f'{year:04}-{month:02}'
  line=text.split('Saldo Inicial Saldo Contable Retenciones Saldo Disponible\n')[1].split('\n')[0]
  balances=[int(n.replace('.','')) for n in re.findall(r'\$\s*([\d.]+)',line)]
  if len(balances)!=4: raise ValueError('No se pudieron identificar los saldos.')
  opening,closing,holds,available=balances
  if holds!=0 or available!=closing: raise ValueError('Esta cartola contiene retenciones: requiere revisión antes de importar.')
  rows=[]
  for p in pdf.pages:
   words=p.extract_words()
   headers=[w for w in words if w['text']=='Cargo']
   if not headers:
    if re.search(r'\d{2}/\d{2}/\d{4}',p.extract_text() or ''): raise ValueError('Página de movimientos sin columnas reconocibles.')
    continue
   header=headers[0]
   abono=next(w for w in words if w['text']=='Abono' and abs(w['top']-header['top'])<2)
   saldo=next(w for w in words if w['text']=='Saldo' and abs(w['top']-header['top'])<2)
   desc=next(w for w in words if w['text'].startswith('Descrip') and abs(w['top']-header['top'])<2)
   for d in [w for w in words if w['top']>header['top'] and re.fullmatch(r'\d{2}/\d{2}/\d{4}',w['text']) and w['x0']<100]:
    line=sorted([w for w in words if abs(w['top']-d['top'])<2],key=lambda w:w['x0'])
    nums=[w for w in line if w['x0']>header['x0']-30 and re.fullmatch(r'[\d.]+',w['text'])]
    if len(nums)!=2: raise ValueError('Fila monetaria ambigua.')
    amount=int(nums[0]['text'].replace('.','')); balance=int(nums[1]['text'].replace('.',''))
    # Columns use right-aligned amounts; distinguish by their right edges.
    income=nums[0]['x1']>abono['x0']
    date=datetime.strptime(d['text'],'%d/%m/%Y').strftime('%Y-%m-%d')
    if not date.startswith(period): raise ValueError('Hay movimientos fuera del período.')
    description=' '.join(w['text'] for w in line if desc['x0']-2<=w['x0']<header['x0']-30)
    if not description or not 0<amount<=2147483647: raise ValueError('Movimiento inválido.')
    rows.append({'date':date,'description':description,'type':'INCOME' if income else 'EXPENSE','amount':amount,'balanceAfter':balance})
  running=opening
  for row in reversed(rows):
   running+=row['amount'] if row['type']=='INCOME' else -row['amount']
   if running!=row['balanceAfter']: raise ValueError('Los movimientos no cuadran con los saldos de la cartola.')
  if running!=closing or not rows: raise ValueError('La cartola no cuadra o no tiene movimientos reconocibles.')
  key=hashlib.sha256(('falabella:'+number).encode()).hexdigest()
  normalized={'key':key,'period':period,'opening':opening,'closing':closing,'rows':rows}
  fingerprint=hashlib.sha256(json.dumps(normalized,sort_keys=True,ensure_ascii=True).encode()).hexdigest()
  return {'bankImportKey':key,'last4':re.sub(r'\D','',number)[-4:],'period':period,'openingBalance':opening,'closingBalance':closing,'balanceAsOf':f'{period}-{calendar.monthrange(year,month)[1]}','fingerprint':fingerprint,'rows':rows}
if __name__=='__main__':
 try:
  result=parse(sys.stdin.buffer.read())
  print(json.dumps(result,ensure_ascii=True))
 except Exception:
  print('No se pudo validar esta cartola. Usa el PDF histórico original de Falabella, sin contraseña y con todas sus páginas.',file=sys.stderr)
  sys.exit(1)
