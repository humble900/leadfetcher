import dns from 'dns';
/**
 * Validate email syntax
 */
export function validateEmailSyntax(email: string): boolean {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}
/**
 * Check if the email domain has valid MX records
 */
export async function checkMxRecords(email: string): Promise<boolean> {
    const domain = email.split('@')[1];
    if (!domain)
        return false;
    try {
        const mxRecords = await dns.promises.resolveMx(domain);
        return mxRecords && mxRecords.length > 0;
    }
    catch (err) {
        // If lookup fails, no MX records exist
        return false;
    }
}
/**
 * Full verification check (Syntax + DNS MX lookup)
 */
export async function verifyEmail(email: string): Promise<boolean> {
    if (!validateEmailSyntax(email))
        return false;
    return await checkMxRecords(email);
}