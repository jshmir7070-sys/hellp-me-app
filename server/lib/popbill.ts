import crypto from 'crypto';

const POPBILL_LINK_ID = process.env.POPBILL_LINK_ID || '';
const POPBILL_SECRET_KEY = process.env.POPBILL_SECRET_KEY || '';
const POPBILL_IS_TEST = process.env.POPBILL_IS_TEST === 'true';

const API_BASE_URL = POPBILL_IS_TEST
  ? 'https://popbill-test.linkhub.co.kr'
  : 'https://popbill.linkhub.co.kr';

interface PopbillTokenResponse {
  session_token: string;
  serviceID: string;
  linkID: string;
  userID: string;
  expiration: string;
  ipaddress: string;
  scope: string[];
}

interface TaxInvoiceItem {
  serialNum: number;
  purchaseDT?: string;
  itemName?: string;
  spec?: string;
  qty?: number;
  unitCost?: number;
  supplyCost: number;
  tax: number;
  remark?: string;
}

interface TaxInvoiceData {
  writeDate: string;
  chargeDirection: number;
  issueType: string;
  purposeType: string;
  taxType: string;
  supplyCostTotal: number;
  taxTotal: number;
  totalAmount: number;
  invoicerCorpNum: string;
  invoicerCorpName: string;
  invoicerCEOName: string;
  invoicerAddr?: string;
  invoicerBizType?: string;
  invoicerBizClass?: string;
  invoicerEmail?: string;
  invoiceeType: string;
  invoiceeCorpNum: string;
  invoiceeCorpName: string;
  invoiceeCEOName: string;
  invoiceeAddr?: string;
  invoiceeBizType?: string;
  invoiceeBizClass?: string;
  invoiceeEmail1?: string;
  remark1?: string;
  remark2?: string;
  remark3?: string;
  detailList?: TaxInvoiceItem[];
}

let cachedToken: { token: string; expires: Date } | null = null;

async function getAccessToken(corpNum: string): Promise<string> {
  if (cachedToken && cachedToken.expires > new Date()) {
    return cachedToken.token;
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const signTarget = `${POPBILL_LINK_ID}.${timestamp}`;
  const signature = crypto
    .createHmac('sha256', POPBILL_SECRET_KEY)
    .update(signTarget)
    .digest('base64');

  const response = await fetch(`${API_BASE_URL}/Token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pb-version': '1.0',
      'x-lh-date': timestamp,
      'x-lh-forwarded': '',
    },
    body: JSON.stringify({
      access_id: POPBILL_LINK_ID,
      scope: ['170'],
      grant_type: '',
      client_id: corpNum,
      client_secret: signature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`팝빌 토큰 발급 실패: ${error}`);
  }

  const data = (await response.json()) as PopbillTokenResponse;
  cachedToken = {
    token: data.session_token,
    expires: new Date(data.expiration),
  };

  return cachedToken.token;
}

async function callPopbillAPI(
  method: string,
  path: string,
  corpNum: string,
  body?: any
): Promise<any> {
  if (!POPBILL_LINK_ID || !POPBILL_SECRET_KEY) {
    throw new Error('POPBILL_LINK_ID 또는 POPBILL_SECRET_KEY가 설정되지 않았습니다');
  }

  const token = await getAccessToken(corpNum);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-pb-version': '1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`팝빌 API 오류: ${error}`);
  }

  return response.json();
}

function generateMgtKey(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `HM${timestamp}${random}`.toUpperCase();
}

export const popbill = {
  isConfigured(): boolean {
    return !!(POPBILL_LINK_ID && POPBILL_SECRET_KEY);
  },

  generateMgtKey,

  async registIssue(
    corpNum: string,
    mgtKey: string,
    invoice: TaxInvoiceData
  ): Promise<{ code: number; message: string; ntsConfirmNum?: string }> {
    const path = `/Taxinvoice`;
    const body = {
      ...invoice,
      invoicerMgtKey: mgtKey,
    };

    const result = await callPopbillAPI('POST', path, corpNum, body);
    return result;
  },

  async registRequest(
    corpNum: string,
    mgtKey: string,
    invoice: TaxInvoiceData,
    memo?: string
  ): Promise<{ code: number; message: string }> {
    const path = `/Taxinvoice`;
    const body = {
      ...invoice,
      invoiceeType: '사업자',
      invoiceeMgtKey: mgtKey,
    };

    const result = await callPopbillAPI('POST', `${path}?Memo=${memo || ''}`, corpNum, body);
    return result;
  },

  async getInfo(
    corpNum: string,
    mgtKeyType: 'SELL' | 'BUY' | 'TRUSTEE',
    mgtKey: string
  ): Promise<any> {
    const path = `/Taxinvoice/${mgtKeyType}/${mgtKey}`;
    return callPopbillAPI('GET', path, corpNum);
  },

  async getDetailInfo(
    corpNum: string,
    mgtKeyType: 'SELL' | 'BUY' | 'TRUSTEE',
    mgtKey: string
  ): Promise<any> {
    const path = `/Taxinvoice/${mgtKeyType}/${mgtKey}?Detail`;
    return callPopbillAPI('GET', path, corpNum);
  },

  async getURL(
    corpNum: string,
    togo: 'TBOX' | 'SBOX' | 'PBOX' | 'WRITE'
  ): Promise<{ url: string }> {
    const path = `/Taxinvoice?TG=${togo}`;
    return callPopbillAPI('GET', path, corpNum);
  },

  async getPDF(
    corpNum: string,
    mgtKeyType: 'SELL' | 'BUY' | 'TRUSTEE',
    mgtKey: string
  ): Promise<{ url: string }> {
    const path = `/Taxinvoice/${mgtKeyType}/${mgtKey}?PDF`;
    return callPopbillAPI('GET', path, corpNum);
  },

  async sendEmail(
    corpNum: string,
    mgtKeyType: 'SELL' | 'BUY' | 'TRUSTEE',
    mgtKey: string,
    receiverEmail: string
  ): Promise<{ code: number; message: string }> {
    const path = `/Taxinvoice/${mgtKeyType}/${mgtKey}/Email`;
    return callPopbillAPI('POST', path, corpNum, { receiverEmail });
  },

  async cancelIssue(
    corpNum: string,
    mgtKeyType: 'SELL' | 'BUY' | 'TRUSTEE',
    mgtKey: string,
    memo?: string
  ): Promise<{ code: number; message: string }> {
    const path = `/Taxinvoice/${mgtKeyType}/${mgtKey}/Cancel`;
    return callPopbillAPI('POST', path, corpNum, { memo });
  },

  buildTaxInvoice(params: {
    type: 'forward' | 'reverse';
    writeDate: string;
    supplierCorpNum: string;
    supplierCorpName: string;
    supplierCeoName: string;
    supplierAddr?: string;
    supplierBizType?: string;
    supplierBizClass?: string;
    supplierEmail?: string;
    buyerCorpNum: string;
    buyerCorpName: string;
    buyerCeoName: string;
    buyerAddr?: string;
    buyerBizType?: string;
    buyerBizClass?: string;
    buyerEmail?: string;
    supplyAmount: number;
    vatAmount: number;
    remark1?: string;
    remark2?: string;
    remark3?: string;
    items?: Array<{
      itemName: string;
      qty: number;
      unitCost: number;
      supplyCost: number;
      tax: number;
    }>;
  }): TaxInvoiceData {
    const detailList: TaxInvoiceItem[] = params.items?.map((item, idx) => ({
      serialNum: idx + 1,
      itemName: item.itemName,
      qty: item.qty,
      unitCost: item.unitCost,
      supplyCost: item.supplyCost,
      tax: item.tax,
    })) || [{
      serialNum: 1,
      itemName: '배송대행 서비스',
      qty: 1,
      unitCost: params.supplyAmount,
      supplyCost: params.supplyAmount,
      tax: params.vatAmount,
    }];

    return {
      writeDate: params.writeDate,
      chargeDirection: params.type === 'forward' ? 0 : 1,
      issueType: params.type === 'forward' ? '정발행' : '역발행',
      purposeType: '영수',
      taxType: '과세',
      supplyCostTotal: params.supplyAmount,
      taxTotal: params.vatAmount,
      totalAmount: params.supplyAmount + params.vatAmount,
      invoicerCorpNum: params.supplierCorpNum,
      invoicerCorpName: params.supplierCorpName,
      invoicerCEOName: params.supplierCeoName,
      invoicerAddr: params.supplierAddr,
      invoicerBizType: params.supplierBizType,
      invoicerBizClass: params.supplierBizClass,
      invoicerEmail: params.supplierEmail,
      invoiceeType: '사업자',
      invoiceeCorpNum: params.buyerCorpNum,
      invoiceeCorpName: params.buyerCorpName,
      invoiceeCEOName: params.buyerCeoName,
      invoiceeAddr: params.buyerAddr,
      invoiceeBizType: params.buyerBizType,
      invoiceeBizClass: params.buyerBizClass,
      invoiceeEmail1: params.buyerEmail,
      remark1: params.remark1,
      remark2: params.remark2,
      remark3: params.remark3,
      detailList,
    };
  },
};
