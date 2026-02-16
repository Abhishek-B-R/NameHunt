const rateLimitMap = new Map()
const LIMIT = 4
export const INTERVAL = 60 * 1000

export const checkRateLimit = (ip: string) => {
    const currentTime = Date.now();
    const resetTime = currentTime + INTERVAL;

    if(rateLimitMap.has(ip)){
        const { count, expiresAt } = rateLimitMap.get(ip);
        if(currentTime > expiresAt){
            rateLimitMap.set(ip, {count: 1, expiresAt: resetTime})
            return false;
        }
        if(count < LIMIT){
            rateLimitMap.set(ip, {count: count + 1, expiresAt: resetTime})
            return false;
        }
        return true;
    }else {
        rateLimitMap.set(ip, { count: 1, expiresAt: resetTime });
        return false;
    }
}