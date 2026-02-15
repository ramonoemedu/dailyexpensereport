import { ProfileData, PersonalInfo, Experience, Education, Skill, Language } from '../types';

export const parseHTMLToProfile = (html: string): ProfileData => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const profileData: ProfileData = {
        personal: parsePersonalInfo(doc),
        experience: parseExperience(doc),
        education: parseEducation(doc),
        skills: parseSkills(doc),
        languages: parseLanguages(doc),
        summary: parseSummary(doc),
    };

    return profileData;
};

function parsePersonalInfo(doc: Document): PersonalInfo {
    const text = doc.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    let name = '';
    let email = '';
    let phone = '';
    let address = '';
    let sex = '';
    let height = '';
    let dateOfBirth = '';
    let placeOfBirth = '';
    let maritalStatus = '';
    let health = '';

    // Parse CONTACT INFORMATION section with key-value pairs
    const contactMatch = text.match(/(?:CONTACT\s+INFORMATION)([\s\S]*?)(?=\n##|$)/i);
    if (contactMatch) {
        const contactLines = contactMatch[1].split('\n');
        contactLines.forEach(line => {
            const phoneMatch = line.match(/(?:Phone|Tel)\s*:?\s*\*?\*?([^*\n]+)/i);
            const emailMatch = line.match(/(?:Email)\s*:?\s*\*?\*?([^*\n]+)/i);
            const addressMatch = line.match(/(?:Address|Location)\s*:?\s*\*?\*?([^*\n]+)/i);
            
            if (phoneMatch) phone = phoneMatch[1].trim();
            if (emailMatch) email = emailMatch[1].trim();
            if (addressMatch) address = addressMatch[1].trim();
        });
    }

    // Parse PERSONAL INFORMATION section
    const personalMatch = text.match(/(?:PERSONAL\s+INFORMATION)([\s\S]*?)(?=\n##|$)/i);
    if (personalMatch) {
        const personalLines = personalMatch[1].split('\n');
        personalLines.forEach(line => {
            const nameMatch = line.match(/(?:\*\*)?Name(?:\*\*)?\s*:?\s*\*?\*?([^*\n]+)/i);
            const sexMatch = line.match(/(?:\*\*)?Sex(?:\*\*)?\s*:?\s*\*?\*?([^*\n]+)/i);
            const heightMatch = line.match(/(?:\*\*)?Height(?:\*\*)?\s*:?\s*\*?\*?([^*\n]+)/i);
            const dobMatch = line.match(/(?:\*\*)?Date of Birth(?:\*\*)?\s*:?\s*\*?\*?([^*\n]+)/i);
            const pobMatch = line.match(/(?:\*\*)?Place of Birth(?:\*\*)?\s*:?\s*\*?\*?([^*\n]+)/i);
            const maritalMatch = line.match(/(?:\*\*)?Marital Status(?:\*\*)?\s*:?\s*\*?\*?([^*\n]+)/i);
            const healthMatch = line.match(/(?:\*\*)?Health(?:\*\*)?\s*:?\s*\*?\*?([^*\n]+)/i);

            if (nameMatch && !name) name = nameMatch[1].trim();
            if (sexMatch) sex = sexMatch[1].trim();
            if (heightMatch) height = heightMatch[1].trim();
            if (dobMatch) dateOfBirth = dobMatch[1].trim();
            if (pobMatch) placeOfBirth = pobMatch[1].trim();
            if (maritalMatch) maritalStatus = maritalMatch[1].trim();
            if (healthMatch) health = healthMatch[1].trim();
        });
    }

    // Fallback: Find name from title or first heading
    if (!name) {
        const titleMatch = text.match(/^#\s+([^\n]+)/m);
        if (titleMatch) {
            name = titleMatch[1].split('-')[0].trim();
        }
    }

    return {
        name: name || 'Profile',
        email,
        phone,
        address,
        sex,
        height,
        dateOfBirth,
        placeOfBirth,
        maritalStatus,
        health
    };
}

function parseExperience(doc: Document): Experience[] {
    const experiences: Experience[] = [];
    const text = doc.body.innerText;
    
    // Look for WORK EXPERIENCE section
    const workExpMatch = text.match(
        /(?:WORK\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|EXPERIENCE)([\s\S]*?)(?=\n(?:EDUCATION|SKILLS|LANGUAGES|$))/i
    );

    if (!workExpMatch) return experiences;

    const expSection = workExpMatch[1];
    
    // Split by ### (subsection headers like ### Position - Company)
    const expBlocks = expSection.split(/\n###\s+/);

    for (const block of expBlocks) {
        if (!block.trim()) continue;

        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) continue;

        const firstLine = lines[0];
        
        // Parse: "Position - Company (dates)" or "Position - Company (dates)"
        const expMatch = firstLine.match(/^([^-]+?)\s*[-–—]\s*(.+?)\s*\((.+?)\)?\s*$/);
        
        if (expMatch) {
            const position = expMatch[1].trim();
            const company = expMatch[2].trim();
            const dateRange = expMatch[3] ? expMatch[3].trim() : '';
            
            // Parse dates like "2023-Rep 2025" or "Mar 2025-Present"
            const dateMatch = dateRange.match(/(.+?)[-–—\s]+(.+)/);
            const startDate = dateMatch ? dateMatch[1].trim() : '';
            const endDate = dateMatch ? dateMatch[2].trim() : '';
            const isCurrent = endDate.toLowerCase().includes('present');

            // Description is remaining lines
            const description = lines.slice(1).filter(l => !l.startsWith('###'));

            experiences.push({
                position,
                company,
                startDate,
                endDate,
                description,
                isCurrent,
            });
        }
    }

    return experiences;
}

function parseEducation(doc: Document): Education[] {
    const education: Education[] = [];
    const text = doc.body.innerText;

    const eduMatch = text.match(
        /(?:EDUCATION|Academic\s+Background)([\s\S]*?)(?=\n##|WORK\s+EXPERIENCE|SKILLS|LANGUAGES|EXPERIENCE|$)/i
    );

    if (!eduMatch) return education;

    const eduSection = eduMatch[1];
    
    // Split by ### (subsection headers like ### School Name (dates))
    const eduBlocks = eduSection.split(/\n###\s+/);

    for (const block of eduBlocks) {
        if (!block.trim()) continue;

        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) continue;

        const firstLine = lines[0];
        
        // Parse: "School Name (dates)" or "School Name (years)"
        const eduMatch = firstLine.match(/^([^(]+?)\s*\((.+?)\)?\s*$/);
        
        if (eduMatch) {
            const school = eduMatch[1].trim();
            const dateRange = eduMatch[2] ? eduMatch[2].trim() : '';
            
            // Parse dates like "2017-2023" or "2023-Present"
            const dateMatch = dateRange.match(/(\d{4}|Present)[-–—\s]+(\d{4}|Present)?/);
            const startYear = dateMatch ? dateMatch[1] : '';
            const endYear = dateMatch ? dateMatch[2] : '';

            // Details are remaining lines
            const details = lines.slice(1).filter(l => !l.startsWith('###'));

            // Try to find major from the details
            let major = '';
            let degree = '';
            for (const detail of details) {
                const majorMatch = detail.match(/(?:\*\*)?(?:Major|Degree|Program)\s*:?\s*\*?\*?(.+)/i);
                if (majorMatch) {
                    major = majorMatch[1].trim();
                    break;
                }
            }

            education.push({
                school,
                degree,
                major,
                startYear,
                endYear,
                details,
            });
        }
    }

    return education;
}

function parseSkills(doc: Document): Skill[] {
    const skills: Skill[] = [];
    const text = doc.body.innerText;

    const skillsMatch = text.match(/(?:SKILLS|Competencies)([\s\S]*?)(?=\n##|LANGUAGES|EDUCATION|EXPERIENCE|PROFILE|$)/i);

    if (!skillsMatch) return skills;

    const skillsSection = skillsMatch[1];
    const skillLines = skillsSection
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));

    // Extract skills from bullet points, removing ** markers
    const skillList = skillLines.map(line => {
        return line.replace(/^[-•*]\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1');
    });

    if (skillList.length > 0) {
        skills.push({ skills: skillList });
    }

    return skills;
}

function parseLanguages(doc: Document): Language[] {
    const languages: Language[] = [];
    const text = doc.body.innerText;

    const langMatch = text.match(/(?:LANGUAGES?)([\s\S]*?)(?=\n##|SKILLS|EDUCATION|EXPERIENCE|PROFILE|$)/i);

    if (!langMatch) return languages;

    const langSection = langMatch[1];
    const langLines = langSection.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of langLines) {
        // Match patterns like "- **English:** Medium" or "English: Medium"
        const langMatch = line.match(/(?:^[-•*]\s*)?(?:\*\*)?([^*:]+)(?:\*\*)?\s*:\s*(.+)/i);
        
        if (langMatch) {
            languages.push({
                language: langMatch[1].trim(),
                proficiency: langMatch[2].trim(),
            });
        } else if (line && !line.startsWith('#')) {
            languages.push({
                language: line.replace(/^[-•*]\s*/, ''),
                proficiency: '',
            });
        }
    }

    return languages;
}

function parseSummary(doc: Document): string {
    const text = doc.body.innerText;

    const summaryMatch = text.match(
        /(?:PROFILE\s+SUMMARY|SUMMARY|PROFESSIONAL\s+SUMMARY)([\s\S]*?)(?=\n(?:EDUCATION|WORK\s+EXPERIENCE|SKILLS|EXPERIENCE|$))/i
    );

    if (!summaryMatch) return '';

    return summaryMatch[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l)
        .join(' ');
}
