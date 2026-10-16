"""Import pinned CC0 orchestral recordings; retain original bytes and provenance."""
import audioop, hashlib, json, pathlib, urllib.parse, urllib.request, wave

ROOT = pathlib.Path(__file__).resolve().parents[1]
LIBRARIES = {
    'vsco': ('sgossner/VSCO-2-CE', '440300901dfe9275fd84e0b7763af1f8443ae62e'),
    'vcsl': ('sgossner/VCSL', 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e'),
}
ENTRIES = []
def add(group, library, folder, filenames):
    for filename, note in filenames:
        ENTRIES.append((group, library, folder + '/' + filename, note))

# VSCO filenames use the octave below scientific pitch notation.
add('violin-short', 'vsco', 'Strings/Violin Section/Spic', [
    ('VlnEns_Spic_D3_v2_rr1.wav','D4'), ('VlnEns_Spic_A3_v2_rr1.wav','A4'),
    ('VlnEns_Spic_C4_v2_rr1.wav','C5'), ('VlnEns_Spic_G4_v2_rr1.wav','G5')])
add('violin-long', 'vsco', 'Strings/Violin Section/susVib', [
    ('VlnEns_susVib_A3_v2.wav','A4'), ('VlnEns_susVib_C4_v2.wav','C5'),
    ('VlnEns_susVib_G4_v2.wav','G5'), ('VlnEns_susVib_D5_v2.wav','D6')])
add('violin-tremolo', 'vsco', 'Strings/Violin Section/Trem', [
    ('VlnEns_Trem_C4_v2.wav','C5'), ('VlnEns_Trem_D5_v2.wav','D6')])
add('cello-short', 'vsco', 'Strings/Cello Section/spic', [
    ('spic_C1_v2_RR1.wav','C2'), ('spic_D2_v2_RR1.wav','D3'), ('spic_C3_v2_RR1.wav','C4')])
add('horn', 'vsco', 'Brass/F Horn/sus', [
    ('MOHorn_sus_D2_v2_1.wav','D3'), ('MOHorn_sus_F2_v2_1.wav','F3'), ('MOHorn_sus_C3_v2_1.wav','C4')])
add('trumpet', 'vsco', 'Brass/Trumpet/stac', [
    ('Sum_SHTrumpet_stac_C3_v2_rr1.wav','C4'), ('Sum_SHTrumpet_stac_D4_v2_rr1.wav','D5')])
add('flute', 'vsco', 'Woodwinds/Flute/stac', [
    ('LDFlute_stac_C4_v2_rr1.wav','C5'), ('LDFlute_stac_C5_v2_rr1.wav','C6')])
add('bass-drum', 'vcsl', 'Membranophones/Struck Membranophones/Bass Drum 1', [
    ('BDrumNew_hit_v3_rr1_Sum.wav','C4'), ('BDrumNew_hit_v3_rr2_Sum.wav','C4')])
add('snare', 'vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1', [
    ('Snare2_HitSN_v3_rr1_Mid.wav','C4'), ('Snare2_HitSN_v3_rr2_Mid.wav','C4')])
add('cymbal', 'vcsl', 'Idiophones/Struck Idiophones/Clash Cymbals 1', [
    ('cymbal_crash1_mf1.wav','C4'), ('cymbal_crash1_ff2.wav','C4')])
add('pipe-organ', 'vcsl', 'Aerophones/Edge-blown Aerophones/Pipe Organ/Loud', [
    ('Rode_Man3Open_C4.wav','C4'), ('Rode_Man3Open_A4.wav','A4'), ('Rode_Man3Open_C5.wav','C5')])
add('violin-long', 'vsco', 'Strings/Violin Section/susVib', [('VlnEns_susVib_D3_v2.wav','D4')])

add('tambourine', 'vcsl', 'Idiophones/Struck Idiophones/Tambourine 1', [
    ('Tamb1_Shake_rr1_Mid.wav','C4'), ('Tamb1_Shake_rr2_Mid.wav','C4')])
add('cello-long', 'vsco', 'Strings/Cello Section/susvib', [('susvib_D2_v3_1.wav','D3')])
add('trumpet-long', 'vsco', 'Brass/Trumpet/straightM-sus', [('Sum_SHTrumpet_straightM-sus_D3_v3_rr1.wav','D4')])

add('maracas', 'vsco', 'VSCO 1 Percussion/varWood', [('maraca1.wav','C4'), ('maraca2.wav','C4')])

def frequency(note):
    pitch={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[note[0]]
    return 440 * 2 ** (((int(note[-1])+1)*12+pitch-69)/12)

def main():
    groups={}
    for index,(group,library,remote,note) in enumerate(ENTRIES):
        repo,revision=LIBRARIES[library]
        url='https://raw.githubusercontent.com/'+repo+'/'+revision+'/'+urllib.parse.quote(remote,safe='/')
        relative='api/audio/samples/orchestra-'+group+'-'+str(index)+'.wav'
        target=ROOT/relative
        if not target.exists():
            with urllib.request.urlopen(url,timeout=45) as response: target.write_bytes(response.read())
        with wave.open(str(target),'rb') as sample:
            seconds=sample.getnframes()/sample.getframerate()
            peak=audioop.max(sample.readframes(sample.getnframes()),sample.getsampwidth())/2**(sample.getsampwidth()*8-1)
        groups.setdefault(group,[]).append(dict(url=relative,rootFrequency=frequency(note),note=note,
            durationSeconds=seconds,peakAmplitude=peak,sourceUrl=url,library=library,
            sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
        print(group,note,round(seconds,2),flush=True)
    for library,(repo,revision) in LIBRARIES.items():
        target=ROOT/('api/audio/samples/orchestra-'+library+'-LICENSE.txt')
        if not target.exists():
            with urllib.request.urlopen('https://raw.githubusercontent.com/'+repo+'/'+revision+'/LICENSE',timeout=30) as response:
                target.write_bytes(response.read())
    manifest=dict(license='CC0-1.0',libraries={key:dict(repository='https://github.com/'+repo,revision=revision,
        licensePath='api/audio/samples/orchestra-'+key+'-LICENSE.txt') for key,(repo,revision) in LIBRARIES.items()},groups=groups)
    (ROOT/'api/audio/instruments/neon-orchestra-samples.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')

if __name__=='__main__': main()
