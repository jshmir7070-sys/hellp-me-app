import { Request } from 'express';

export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  rawHeaders?: Record<string, string>;
}

export function getClientInfo(req: Request): ClientInfo {
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  let ipAddress = 'unknown';
  if (typeof forwardedFor === 'string') {
    ipAddress = forwardedFor.split(',')[0].trim();
  } else if (typeof realIp === 'string') {
    ipAddress = realIp;
  } else if (req.ip) {
    ipAddress = req.ip;
  } else if (req.socket?.remoteAddress) {
    ipAddress = req.socket.remoteAddress;
  }
  
  if (ipAddress.startsWith('::ffff:')) {
    ipAddress = ipAddress.substring(7);
  }
  
  const userAgent = (req.headers['user-agent'] || 'unknown') as string;
  
  return {
    ipAddress,
    userAgent,
    timestamp: new Date(),
  };
}

export function extractDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  const ua = userAgent.toLowerCase();
  
  if (/android.*mobile|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (/android|ipad|tablet/i.test(ua)) {
    return 'tablet';
  }
  if (/windows|macintosh|linux/i.test(ua) && !/mobile/i.test(ua)) {
    return 'desktop';
  }
  return 'unknown';
}

export function extractOsInfo(userAgent: string): string {
  const ua = userAgent;
  
  if (/Windows NT 10/.test(ua)) return 'Windows 10';
  if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.2/.test(ua)) return 'Windows 8';
  if (/Mac OS X (\d+[._]\d+)/.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    return `macOS ${match?.[1]?.replace('_', '.')}`;
  }
  if (/Android (\d+\.?\d*)/.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    return `Android ${match?.[1]}`;
  }
  if (/iPhone OS (\d+_\d+)/.test(ua) || /iPad.*OS (\d+_\d+)/.test(ua)) {
    const match = ua.match(/OS (\d+_\d+)/);
    return `iOS ${match?.[1]?.replace('_', '.')}`;
  }
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

export function extractBrowserInfo(userAgent: string): string {
  const ua = userAgent;
  
  if (/Edg\/(\d+)/.test(ua)) {
    const match = ua.match(/Edg\/(\d+)/);
    return `Edge ${match?.[1]}`;
  }
  if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) {
    const match = ua.match(/Chrome\/(\d+)/);
    return `Chrome ${match?.[1]}`;
  }
  if (/Firefox\/(\d+)/.test(ua)) {
    const match = ua.match(/Firefox\/(\d+)/);
    return `Firefox ${match?.[1]}`;
  }
  if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) {
    const match = ua.match(/Version\/(\d+)/);
    return `Safari ${match?.[1] || 'Unknown'}`;
  }
  return 'Unknown Browser';
}

export interface ConsentLogEntry {
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  os: string;
  browser: string;
  details?: Record<string, any>;
}

export function createConsentLogEntry(
  req: Request,
  action: string,
  details?: Record<string, any>
): ConsentLogEntry {
  const clientInfo = getClientInfo(req);
  
  return {
    action,
    timestamp: clientInfo.timestamp.toISOString(),
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    deviceType: extractDeviceType(clientInfo.userAgent),
    os: extractOsInfo(clientInfo.userAgent),
    browser: extractBrowserInfo(clientInfo.userAgent),
    details,
  };
}

export function appendConsentLog(
  existingLog: string | null | undefined,
  newEntry: ConsentLogEntry
): string {
  let logs: ConsentLogEntry[] = [];
  
  if (existingLog) {
    try {
      logs = JSON.parse(existingLog);
      if (!Array.isArray(logs)) {
        logs = [logs];
      }
    } catch {
      logs = [];
    }
  }
  
  logs.push(newEntry);
  return JSON.stringify(logs);
}
