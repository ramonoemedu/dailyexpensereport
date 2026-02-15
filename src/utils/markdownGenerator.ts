import { ProfileData } from '../types';

/**
 * Converts ProfileData to structured Markdown
 */
export const generateMarkdownFromProfile = (data: ProfileData): string => {
    let markdown = `# ${data.personal.name || 'Profile'} - Resume\n\n`;

    // Contact Information
    markdown += '## CONTACT INFORMATION\n';
    if (data.personal.phone) markdown += `- **Phone:** ${data.personal.phone}\n`;
    if (data.personal.email) markdown += `- **Email:** ${data.personal.email}\n`;
    if (data.personal.address) markdown += `- **Address:** ${data.personal.address}\n`;
    markdown += '\n';

    // Personal Information
    markdown += '## PERSONAL INFORMATION\n';
    if (data.personal.name) markdown += `- **Name:** ${data.personal.name}\n`;
    if (data.personal.sex) markdown += `- **Sex:** ${data.personal.sex}\n`;
    if (data.personal.height) markdown += `- **Height:** ${data.personal.height}\n`;
    if (data.personal.dateOfBirth) markdown += `- **Date of Birth:** ${data.personal.dateOfBirth}\n`;
    if (data.personal.placeOfBirth) markdown += `- **Place of Birth:** ${data.personal.placeOfBirth}\n`;
    if (data.personal.maritalStatus) markdown += `- **Marital Status:** ${data.personal.maritalStatus}\n`;
    if (data.personal.health) markdown += `- **Health:** ${data.personal.health}\n`;
    markdown += '\n';

    // Education
    if (data.education.length > 0) {
        markdown += '## EDUCATION\n\n';
        data.education.forEach(edu => {
            const dates = edu.startYear ? `(${edu.startYear}${edu.endYear ? '-' + edu.endYear : ''})` : '';
            markdown += `### ${edu.school} ${dates}\n`;
            if (edu.degree) markdown += `- Degree: ${edu.degree}\n`;
            if (edu.major) markdown += `- Major: ${edu.major}\n`;
            if (edu.details && edu.details.length > 0) {
                edu.details.forEach(detail => markdown += `- ${detail}\n`);
            }
            markdown += '\n';
        });
    }

    // Work Experience
    if (data.experience.length > 0) {
        markdown += '## WORK EXPERIENCE\n\n';
        data.experience.forEach(exp => {
            const dates = exp.startDate ? `(${exp.startDate}${exp.endDate ? '-' + exp.endDate : ''})` : '';
            markdown += `### ${exp.position} - ${exp.company} ${dates}\n`;
            if (exp.description && exp.description.length > 0) {
                exp.description.forEach(desc => markdown += `- ${desc}\n`);
            }
            markdown += '\n';
        });
    }

    // Languages
    if (data.languages && data.languages.length > 0) {
        markdown += '## LANGUAGES\n';
        data.languages.forEach(lang => {
            if (lang.proficiency) {
                markdown += `- **${lang.language}:** ${lang.proficiency}\n`;
            } else {
                markdown += `- ${lang.language}\n`;
            }
        });
        markdown += '\n';
    }

    // Skills
    if (data.skills.length > 0) {
        markdown += '## SKILLS\n';
        data.skills.forEach(skillBlock => {
            skillBlock.skills.forEach(skill => {
                markdown += `- ${skill}\n`;
            });
        });
        markdown += '\n';
    }

    // Summary
    if (data.summary) {
        markdown += '## PROFILE SUMMARY\n';
        markdown += `${data.summary}\n`;
    }

    return markdown;
};

/**
 * Converts HTML content to properly formatted Markdown
 * Preserves structure with headings, lists, and paragraphs
 */
export const generateMarkdownFromHTML = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let markdown = '';

    const processNode = (node: Node, depth: number = 0): string => {
        let result = '';

        if (node.nodeType === Node.TEXT_NODE) {
            const text = (node as Text).textContent?.trim() || '';
            if (text) {
                result += text;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tag = element.tagName.toUpperCase();
            const text = element.textContent?.trim() || '';

            if (tag === 'H1') {
                result += `# ${text}\n\n`;
            } else if (tag === 'H2') {
                result += `## ${text}\n\n`;
            } else if (tag === 'H3') {
                result += `### ${text}\n\n`;
            } else if (tag === 'H4') {
                result += `#### ${text}\n\n`;
            } else if (tag === 'H5') {
                result += `##### ${text}\n\n`;
            } else if (tag === 'H6') {
                result += `###### ${text}\n\n`;
            } else if (tag === 'P') {
                result += `${text}\n\n`;
            } else if (tag === 'UL' || tag === 'OL') {
                element.childNodes.forEach((child, index) => {
                    if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toUpperCase() === 'LI') {
                        const liText = (child as Element).textContent?.trim() || '';
                        if (tag === 'UL') {
                            result += `- ${liText}\n`;
                        } else {
                            result += `${index + 1}. ${liText}\n`;
                        }
                    }
                });
                result += '\n';
            } else if (tag === 'LI') {
                // Already handled by UL/OL
                return result;
            } else if (tag === 'BR') {
                result += '\n';
            } else if (tag === 'HR') {
                result += '---\n\n';
            } else if (tag === 'STRONG' || tag === 'B') {
                result += `**${text}**`;
            } else if (tag === 'EM' || tag === 'I') {
                result += `*${text}*`;
            } else if (tag === 'A') {
                const href = element.getAttribute('href') || '';
                result += `[${text}](${href})`;
            } else if (tag === 'CODE') {
                result += `\`${text}\``;
            } else if (tag === 'PRE') {
                result += '```\n' + text + '\n```\n\n';
            } else if (tag === 'BLOCKQUOTE') {
                result += `> ${text}\n\n`;
            } else if (tag === 'TABLE') {
                // Simple table handling
                const rows = element.querySelectorAll('tr');
                rows.forEach((row, rowIndex) => {
                    const cells = row.querySelectorAll('td, th');
                    result += cells.length > 0 ? Array.from(cells).map(cell => cell.textContent?.trim() || '').join(' | ') + '\n' : '';
                    if (rowIndex === 0 && rows[0].querySelector('th')) {
                        result += Array(cells.length).fill('---').join('|') + '\n';
                    }
                });
                result += '\n';
            } else {
                // For other tags, process children
                element.childNodes.forEach(child => {
                    result += processNode(child, depth + 1);
                });
            }
        }

        return result;
    };

    // Process all child nodes
    doc.body.childNodes.forEach(node => {
        markdown += processNode(node);
    });

    // Clean up excessive whitespace
    markdown = markdown
        .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
        .trim();

    return markdown;
};

/**
 * Downloads Markdown content as a file
 */
export const downloadMarkdown = (markdown: string, fileName: string): void => {
    const element = document.createElement('a');
    const fileBlob = new Blob([markdown], { type: 'text/markdown' });
    element.href = URL.createObjectURL(fileBlob);
    element.download = `${fileName}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
};
