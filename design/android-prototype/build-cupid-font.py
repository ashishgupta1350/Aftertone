"""Build the original Lovebit 5x7 headline face. Requires fontTools."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

patterns = {
    'A':'01110/10001/10001/11111/10001/10001/10001',
    'B':'11110/10001/10001/11110/10001/10001/11110',
    'C':'01111/10000/10000/10000/10000/10000/01111',
    'D':'11110/10001/10001/10001/10001/10001/11110',
    'E':'11111/10000/10000/11110/10000/10000/11111',
    'F':'11111/10000/10000/11110/10000/10000/10000',
    'G':'01111/10000/10000/10111/10001/10001/01111',
    'H':'10001/10001/10001/11111/10001/10001/10001',
    'I':'11111/00100/00100/00100/00100/00100/11111',
    'J':'00111/00010/00010/00010/00010/10010/01100',
    'K':'10001/10010/10100/11000/10100/10010/10001',
    'L':'10000/10000/10000/10000/10000/10000/11111',
    'M':'10001/11011/10101/10101/10001/10001/10001',
    'N':'10001/11001/10101/10011/10001/10001/10001',
    'O':'01110/10001/10001/10001/10001/10001/01110',
    'P':'11110/10001/10001/11110/10000/10000/10000',
    'Q':'01110/10001/10001/10001/10101/10010/01101',
    'R':'11110/10001/10001/11110/10100/10010/10001',
    'S':'01111/10000/10000/01110/00001/00001/11110',
    'T':'11111/00100/00100/00100/00100/00100/00100',
    'U':'10001/10001/10001/10001/10001/10001/01110',
    'V':'10001/10001/10001/10001/10001/01010/00100',
    'W':'10001/10001/10001/10101/10101/11011/10001',
    'X':'10001/10001/01010/00100/01010/10001/10001',
    'Y':'10001/10001/01010/00100/00100/00100/00100',
    'Z':'11111/00001/00010/00100/01000/10000/11111',
    '0':'01110/10001/10011/10101/11001/10001/01110',
    '1':'00100/01100/00100/00100/00100/00100/01110',
    '2':'01110/10001/00001/00010/00100/01000/11111',
    '3':'11110/00001/00001/01110/00001/00001/11110',
    '4':'00010/00110/01010/10010/11111/00010/00010',
    '5':'11111/10000/10000/11110/00001/00001/11110',
    '6':'01110/10000/10000/11110/10001/10001/01110',
    '7':'11111/00001/00010/00100/01000/01000/01000',
    '8':'01110/10001/10001/01110/10001/10001/01110',
    '9':'01110/10001/10001/01111/00001/00001/01110',
    '.':'00000/00000/00000/00000/00000/00110/00110',
    ',':'00000/00000/00000/00000/00110/00100/01000',
    ':':'00000/00110/00110/00000/00110/00110/00000',
    '-':'00000/00000/00000/11111/00000/00000/00000',
    '/':'00001/00010/00010/00100/01000/01000/10000',
    '!':'00100/00100/00100/00100/00100/00000/00100',
    '?':'01110/10001/00001/00010/00100/00000/00100',
    "'":'00100/00100/00000/00000/00000/00000/00000',
    '&':'01100/10010/10100/01000/10101/10010/01101',
    '+':'00000/00100/00100/11111/00100/00100/00000',
    '(':'00010/00100/01000/01000/01000/00100/00010',
    ')':'01000/00100/00010/00010/00010/00100/01000',
}

def glyph(pattern):
    pen = TTGlyphPen(None)
    for y, row in enumerate(pattern.split('/')):
        for x, cell in enumerate(row):
            if cell != '1':
                continue
            left, bottom = 50 + x * 100, 100 + (6-y) * 100
            pen.moveTo((left,bottom))
            pen.lineTo((left,bottom+100))
            pen.lineTo((left+100,bottom+100))
            pen.lineTo((left+100,bottom))
            pen.closePath()
    return pen.glyph()

blank = '00000/'*6 + '00000'
cmap = {code:f'uni{code:04X}' for code in range(32,127)}
order = ['.notdef'] + list(cmap.values())
glyphs = {'.notdef':glyph(patterns['?'])}
for code, name in cmap.items():
    glyphs[name] = glyph(patterns.get(chr(code).upper(), blank if code==32 else patterns['?']))
fb = FontBuilder(1000,isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({name:(600,50) for name in order})
fb.setupHorizontalHeader(ascent=900,descent=-100)
fb.setupNameTable({'familyName':'Lovebit','styleName':'Regular','uniqueFontIdentifier':'Aftertone-Lovebit-Regular-1','fullName':'Lovebit Regular','psName':'Lovebit-Regular','version':'Version 1.0','copyright':'Original Aftertone prototype font. CC0.'})
fb.setupOS2(sTypoAscender=900,sTypoDescender=-100,usWinAscent=900,usWinDescent=100,sxHeight=700,sCapHeight=700)
fb.setupPost()
fb.setupMaxp()
out=Path(__file__).parent/'assets'/'cupid'/'lovebit.ttf'
out.parent.mkdir(parents=True,exist_ok=True)
fb.save(out)
print(f'Built original Lovebit pixel font: {out}')
