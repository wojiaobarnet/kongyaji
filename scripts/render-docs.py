#!/usr/bin/env python3
"""Render the complete Chinese project Markdown as a readable PDF."""
from pathlib import Path
import html,re,os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,KeepTogether

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/项目文档.md'
TARGET=ROOT/'docs/项目文档.pdf'
font_path=os.environ.get('DOCS_CJK_FONT') or next((str(p) for p in [Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf'),Path('/usr/share/fonts/truetype/wqy/wqy-microhei.ttc')] if p.exists()),None)
if not font_path:raise SystemExit('Set DOCS_CJK_FONT to a Chinese-capable TrueType font file.')
pdfmetrics.registerFont(TTFont('ProjectCJK',font_path,subfontIndex=0))
pdfmetrics.registerFontFamily('ProjectCJK',normal='ProjectCJK',bold='ProjectCJK',italic='ProjectCJK',boldItalic='ProjectCJK')
font='ProjectCJK';width=A4[0]-108
body=ParagraphStyle('Body',fontName=font,fontSize=10,leading=15,spaceAfter=6,wordWrap='CJK')
heading1=ParagraphStyle('Title',parent=body,fontSize=23,leading=31,textColor=colors.HexColor('#14375a'),spaceAfter=17,keepWithNext=True)
heading2=ParagraphStyle('Section',parent=body,fontSize=15,leading=21,textColor=colors.HexColor('#155e9c'),spaceBefore=14,spaceAfter=9,keepWithNext=True)
heading3=ParagraphStyle('Subsection',parent=body,fontSize=11.5,leading=17,spaceBefore=9,keepWithNext=True)
code=ParagraphStyle('Code',parent=body,fontSize=8.5,leading=12,backColor=colors.HexColor('#f2f5f8'),borderPadding=8,spaceBefore=5,spaceAfter=10)
cell=ParagraphStyle('Cell',parent=body,fontSize=9,leading=14,spaceAfter=0)
headcell=ParagraphStyle('HeaderCell',parent=cell,textColor=colors.white)

def inline(value):
 value=html.escape(value)
 value=re.sub(r'\[([^]]+)\]\((https?://[^)]+)\)',r'<link href="\2" color="#155e9c">\1</link>',value)
 value=re.sub(r'\[([^]]+)\]\(([^)]+)\)',r'\1 (\2)',value)
 value=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',value)
 value=re.sub(r'`([^`]+)`',r'<font color="#14375a">\1</font>',value)
 return value

def footer(canvas,doc):
 canvas.saveState();canvas.setStrokeColor(colors.HexColor('#dde5ee'));canvas.line(54,44,A4[0]-54,44)
 canvas.setFont(font,8);canvas.setFillColor(colors.HexColor('#6e8093'))
 canvas.drawString(54,31,'東悍 donghan / 项目与部署说明')
 canvas.drawRightString(A4[0]-54,31,str(doc.page));canvas.restoreState()

story=[];lines=SOURCE.read_text(encoding='utf-8').splitlines();i=0
while i<len(lines):
 line=lines[i].rstrip();i+=1
 if not line:continue
 if line.startswith('```'):
  block=[]
  while i<len(lines) and not lines[i].startswith('```'):block.append(lines[i]);i+=1
  i+=1
  story.append(KeepTogether([Paragraph('<br/>'.join(html.escape(s).replace('  ','&#160;&#160;') for s in block),code)]));continue
 if line.startswith('|'):
  rows=[line]
  while i<len(lines) and lines[i].startswith('|'):rows.append(lines[i]);i+=1
  parsed=[]
  for row in rows:
   values=[s.strip() for s in row.strip('|').split('|')]
   if all(re.fullmatch(r':?-+:?',s) for s in values):continue
   parsed.append([Paragraph(inline(s),headcell if not parsed else cell) for s in values])
  columns=len(parsed[0]);colwidths=[width*.28]+[width*.72/(columns-1)]*(columns-1) if columns>1 else [width]
  table=Table(parsed,colWidths=colwidths,repeatRows=1,hAlign='LEFT')
  table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#245c8c')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f3f6f9'),colors.white]),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#dce4eb')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
  story.extend([table,Spacer(1,10)]);continue
 if line.startswith('# '):story.append(Paragraph(inline(line[2:]),heading1));continue
 if line.startswith('## '):story.append(Paragraph(inline(line[3:]),heading2));continue
 if line.startswith('### '):story.append(Paragraph(inline(line[4:]),heading3));continue
 if line.startswith('- '):story.append(Paragraph('• '+inline(line[2:]),body));continue
 paragraph=[line]
 while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||-|```)',lines[i]):paragraph.append(lines[i].strip());i+=1
 story.append(Paragraph(inline(' '.join(paragraph)),body))

document=SimpleDocTemplate(str(TARGET),pagesize=A4,rightMargin=54,leftMargin=54,topMargin=48,bottomMargin=58,title='東悍 donghan 网站项目文档',author='Donghan project',pageCompression=1)
document.build(story,onFirstPage=footer,onLaterPages=footer)
print(str(TARGET))
