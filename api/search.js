const fs = require('fs');
const path = require('path');

// In-memory cache for serverless environment across warm invocations
let cachedIndex = null;

function loadIndex() {
    if (cachedIndex) return cachedIndex;
    try {
        const filePath = path.join(process.cwd(), 'data', 'search_index.json');
        if (fs.existsSync(filePath)) {
            cachedIndex = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return cachedIndex;
        }
    } catch (e) {
        console.error('Failed to load search index:', e);
    }
    return null;
}

function normalize(str) {
    if (!str) return '';
    return String(str).toLowerCase().trim().replace(/[^a-z0-9\s_]/g, '');
}

// Hindi synonyms & transliteration map
const HINDI_SYNONYMS = {
    'भाजपा': 'bjp', 'राजद': 'rjd', 'जदयू': 'jdu', 'कांग्रेस': 'congress',
    'जन सुराज': 'jsp', 'जनसुराज': 'jsp', 'माले': 'cpiml', 'लोजपा': 'ljp',
    'पूर्वी चंपारण': 'east champaran', 'मोतिहारी': 'motihari', 'बेतिया': 'bettiah',
    'पश्चिमी चंपारण': 'west champaran', 'मुजफ्फरपुर': 'muzaffarpur', 'सीतामढ़ी': 'sitamarhi',
    'शिवहर': 'sheohar', 'वैशाली': 'vaishali', 'हाजीपुर': 'hajipur', 'सीवान': 'siwan',
    'सारण': 'saran', 'छपरा': 'chhapra', 'गोपालगंज': 'gopalganj', 'दरभंगा': 'darbhanga',
    'मधुबनी': 'madhubani', 'समस्तीपुर': 'samastipur', 'रोहतास': 'rohtas', 'सासाराम': 'sasaram',
    'कैमूर': 'kaimur', 'भभुआ': 'bhabhua', 'बक्सर': 'buxar', 'भोजपुर': 'bhojpur', 'आरा': 'arrah',
    'मुंगेर': 'munger', 'भागलपुर': 'bhagalpur', 'बांका': 'banka', 'जमुई': 'jamui',
    'लखीसराय': 'lakhisarai', 'शेखपुरा': 'sheikhpura', 'नालंदा': 'nalanda', 'बिहारशरीफ': 'biharsharif',
    'गया': 'gaya', 'नवादा': 'nawada', 'औरंगाबाद': 'aurangabad', 'जहानाबाद': 'jehanabad', 'अरवल': 'arwal'
};

const DEVANAGARI_MAP = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', '्': '',
    'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy', 'श्र': 'shr'
};

function transliterate(str) {
    if (!str) return '';
    let res = String(str).toLowerCase().trim();
    for (const [hi, en] of Object.entries(HINDI_SYNONYMS)) {
        if (res.includes(hi)) res = res.replaceAll(hi, en);
    }
    let out = '';
    for (let i = 0; i < res.length; i++) {
        const ch = res[i];
        out += DEVANAGARI_MAP[ch] !== undefined ? DEVANAGARI_MAP[ch] : ch;
    }
    return out.toLowerCase().replace(/[^a-z0-9\s_]/g, '');
}

module.exports = async (req, res) => {
    // Set caching headers for edge CDN
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');

    let query = '';
    if (req.query && req.query.q) {
        query = String(req.query.q).trim();
    } else if (req.url && req.url.includes('?')) {
        try {
            const parsedUrl = new URL(req.url, 'http://localhost');
            query = String(parsedUrl.searchParams.get('q') || '').trim();
        } catch (e) {}
    }

    if (!query) {
        return res.status(200).json({ candidates: [], chairmen: [], incumbents: [], seats: [] });
    }

    const index = loadIndex();
    if (!index) {
        return res.status(500).json({ error: 'Search index not available' });
    }

    const rawQ = normalize(query);
    const translitQ = transliterate(query);

    const matchCandidate = [];
    const matchChairman = [];
    const matchIncumbent = [];
    const matchSeat = [];

    const seenCandidates = new Set();
    const seenSeats = new Set();

    // 1. Search Candidates
    for (const c of index.candidates) {
        const normName = normalize(c.name);
        const normPhone = normalize(c.phone);
        const normSeat = normalize(c.seat);
        const normDist = normalize(c.district);

        if (normName.includes(rawQ) || (translitQ && normName.includes(translitQ)) ||
            normPhone.includes(rawQ) || normSeat.includes(rawQ) || normDist.includes(rawQ)) {
            const key = `${c.seat}_${c.name}`;
            if (!seenCandidates.has(key)) {
                seenCandidates.add(key);
                matchCandidate.push({
                    type: 'candidate',
                    title: `${c.name}${c.caste ? ' (' + c.caste + ')' : ''}`,
                    subtitle: `${c.seat} • ${c.district} (${c.zone}) ${c.phone ? '• 📞 ' + c.phone : ''}`,
                    seat: c.seat,
                    district: c.district
                });
                if (matchCandidate.length >= 6) break;
            }
        }
    }

    // 2. Search Chairmen
    for (const ch of index.chairmen) {
        const normCh = normalize(ch.chairman);
        const normDist = normalize(ch.district);
        const normParty = normalize(ch.party);

        if (normCh.includes(rawQ) || (translitQ && normCh.includes(translitQ)) || normDist.includes(rawQ) || normParty.includes(rawQ)) {
            matchChairman.push({
                type: 'chairman',
                title: `👑 ${ch.chairman || 'Chairman'} (${ch.district})`,
                subtitle: `Vice Chairman: ${ch.viceChairman || 'N/A'} • Party: ${ch.party || 'N/A'}`,
                district: ch.district
            });
            if (matchChairman.length >= 4) break;
        }
    }

    // 3. Search Incumbents
    for (const inc of index.incumbents) {
        const normInc = normalize(inc.name);
        const normRu = normalize(inc.runnerupName);
        const normPhone = normalize(inc.number);
        const normSeat = normalize(inc.seat);

        if (normInc.includes(rawQ) || (translitQ && normInc.includes(translitQ)) ||
            normRu.includes(rawQ) || normPhone.includes(rawQ) || normSeat.includes(rawQ)) {
            matchIncumbent.push({
                type: 'incumbent',
                title: `🏛️ ${inc.name || 'Incumbent'} (${inc.seat})`,
                subtitle: `Party: ${inc.party || 'N/A'} • Runner-up: ${inc.runnerupName || 'N/A'} ${inc.number ? '• 📞 ' + inc.number : ''}`,
                seat: inc.seat
            });
            if (matchIncumbent.length >= 4) break;
        }
    }

    // 4. Search Seats
    for (const s of index.seats) {
        const normSeat = normalize(s.seat);
        const normBlock = normalize(s.block);
        const normDist = normalize(s.district);

        if (normSeat.includes(rawQ) || normBlock.includes(rawQ) || normDist.includes(rawQ) ||
            (translitQ && (normSeat.includes(translitQ) || normBlock.includes(translitQ)))) {
            if (!seenSeats.has(s.seat)) {
                seenSeats.add(s.seat);
                matchSeat.push({
                    type: 'seat',
                    title: s.seat,
                    subtitle: `${s.block ? s.block + ', ' : ''}${s.district} (${s.zone})`,
                    seat: s.seat
                });
                if (matchSeat.length >= 4) break;
            }
        }
    }

    return res.status(200).json({
        candidates: matchCandidate,
        chairmen: matchChairman,
        incumbents: matchIncumbent,
        seats: matchSeat
    });
};
