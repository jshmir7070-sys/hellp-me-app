interface SettlementEmailData {
  helperName: string;
  year: number;
  month: number;
  settlements: {
    workDate: string;
    orderTitle: string;
    deliveryCount: number;
    returnCount: number;
    pickupCount: number;
    otherCount: number;
    supplyAmount: number;
    vatAmount: number;
    totalAmount: number;
    commissionAmount: number;
    netAmount: number;
  }[];
  summary: {
    totalDeliveryCount: number;
    totalReturnCount: number;
    totalPickupCount: number;
    totalOtherCount: number;
    totalSupplyAmount: number;
    totalVatAmount: number;
    grandTotalAmount: number;
    totalCommission: number;
    totalInsuranceDeduction: number; // 산재보험료 (헬퍼 50%)
    insuranceRate: number; // 산재보험료율 (%)
    totalOtherDeductions: number; // 기타 차감 (화물사고 등)
    totalNetAmount: number;
    commissionRate: number;
  };
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  isRevised?: boolean;
}

export function generateSettlementEmailHtml(data: SettlementEmailData): string {
  const { helperName, year, month, settlements, summary, bankInfo, isRevised } = data;
  const revisionLabel = isRevised ? ' (수정본)' : ' (1차)';
  
  const formatCurrency = (amount: number) => 
    amount.toLocaleString('ko-KR') + '원';
  
  const settlementRows = settlements.map(s => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${s.workDate}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${s.orderTitle}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${s.deliveryCount}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${s.returnCount}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${s.pickupCount}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${s.otherCount}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">${formatCurrency(s.supplyAmount)}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">${formatCurrency(s.vatAmount)}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px; font-weight: 500;">${formatCurrency(s.totalAmount)}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px; color: #dc2626;">${formatCurrency(s.commissionAmount)}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px; font-weight: 600; color: #059669;">${formatCurrency(s.netAmount)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${year}년 ${month}월 정산서${revisionLabel}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 900px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background-color: ${isRevised ? '#f97316' : '#1e40af'}; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">정산서${revisionLabel}</h1>
              <p style="margin: 8px 0 0; color: ${isRevised ? '#fed7aa' : '#bfdbfe'}; font-size: 16px;">${year}년 ${month}월</p>
              ${isRevised ? '<p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 4px; display: inline-block;">분쟁 해결 후 수정된 정산서입니다</p>' : ''}
            </td>
          </tr>
          
          <!-- Helper Info -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="width: 50%;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">수신</p>
                    <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${helperName} 님</p>
                  </td>
                  <td style="width: 50%; text-align: right;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">정산 기간</p>
                    <p style="margin: 0; color: #111827; font-size: 16px;">${year}년 ${month}월 1일 ~ ${month}월 ${new Date(year, month, 0).getDate()}일</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Cards -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" style="width: 100%; border-collapse: separate; border-spacing: 12px 0;">
                <tr>
                  <td style="width: 33.33%; padding: 20px; background-color: #f0fdf4; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #166534; font-size: 14px; font-weight: 500;">총 수령액</p>
                    <p style="margin: 0; color: #059669; font-size: 24px; font-weight: 700;">${formatCurrency(summary.totalNetAmount)}</p>
                  </td>
                  <td style="width: 33.33%; padding: 20px; background-color: #eff6ff; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #1e40af; font-size: 14px; font-weight: 500;">총 합계금</p>
                    <p style="margin: 0; color: #2563eb; font-size: 24px; font-weight: 700;">${formatCurrency(summary.grandTotalAmount)}</p>
                  </td>
                  <td style="width: 33.33%; padding: 20px; background-color: #fef2f2; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #991b1b; font-size: 14px; font-weight: 500;">총 수수료 (${summary.commissionRate}%)</p>
                    <p style="margin: 0; color: #dc2626; font-size: 24px; font-weight: 700;">${formatCurrency(summary.totalCommission)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="width: 33.33%; padding: 20px; background-color: #fff7ed; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #9a3412; font-size: 14px; font-weight: 500;">산재보험료 (${summary.insuranceRate}% × 50%)</p>
                    <p style="margin: 0; color: #ea580c; font-size: 24px; font-weight: 700;">${formatCurrency(summary.totalInsuranceDeduction)}</p>
                  </td>
                  <td style="width: 33.33%; padding: 20px; background-color: #fef2f2; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #991b1b; font-size: 14px; font-weight: 500;">기타 차감 (사고 등)</p>
                    <p style="margin: 0; color: #dc2626; font-size: 24px; font-weight: 700;">${formatCurrency(summary.totalOtherDeductions)}</p>
                  </td>
                  <td style="width: 33.33%; padding: 20px; border-radius: 8px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Count Summary -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; padding: 16px;">
                <tr>
                  <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">배송</p>
                    <p style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">${summary.totalDeliveryCount}건</p>
                  </td>
                  <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">반품</p>
                    <p style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">${summary.totalReturnCount}건</p>
                  </td>
                  <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">픽업</p>
                    <p style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">${summary.totalPickupCount}건</p>
                  </td>
                  <td style="padding: 12px 16px; text-align: center;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">기타</p>
                    <p style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">${summary.totalOtherCount}건</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Details Table -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: 600;">정산 상세 내역</h2>
              <div style="overflow-x: auto;">
                <table role="presentation" style="width: 100%; border-collapse: collapse; min-width: 800px;">
                  <thead>
                    <tr style="background-color: #f3f4f6;">
                      <th style="padding: 12px 8px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">작업일</th>
                      <th style="padding: 12px 8px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">오더명</th>
                      <th style="padding: 12px 8px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">배송</th>
                      <th style="padding: 12px 8px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">반품</th>
                      <th style="padding: 12px 8px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">픽업</th>
                      <th style="padding: 12px 8px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">기타</th>
                      <th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">공급가액</th>
                      <th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">부가세</th>
                      <th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">합계금</th>
                      <th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">수수료</th>
                      <th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">수령액</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${settlementRows}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #f9fafb;">
                      <td colspan="2" style="padding: 14px 8px; font-size: 14px; font-weight: 600; color: #111827; border-top: 2px solid #d1d5db;">합계</td>
                      <td style="padding: 14px 8px; text-align: center; font-size: 14px; font-weight: 600; color: #111827; border-top: 2px solid #d1d5db;">${summary.totalDeliveryCount}</td>
                      <td style="padding: 14px 8px; text-align: center; font-size: 14px; font-weight: 600; color: #111827; border-top: 2px solid #d1d5db;">${summary.totalReturnCount}</td>
                      <td style="padding: 14px 8px; text-align: center; font-size: 14px; font-weight: 600; color: #111827; border-top: 2px solid #d1d5db;">${summary.totalPickupCount}</td>
                      <td style="padding: 14px 8px; text-align: center; font-size: 14px; font-weight: 600; color: #111827; border-top: 2px solid #d1d5db;">${summary.totalOtherCount}</td>
                      <td style="padding: 14px 8px; text-align: right; font-size: 14px; font-weight: 600; color: #111827; border-top: 2px solid #d1d5db;">${formatCurrency(summary.totalSupplyAmount)}</td>
                      <td style="padding: 14px 8px; text-align: right; font-size: 14px; font-weight: 600; color: #111827; border-top: 2px solid #d1d5db;">${formatCurrency(summary.totalVatAmount)}</td>
                      <td style="padding: 14px 8px; text-align: right; font-size: 14px; font-weight: 600; color: #2563eb; border-top: 2px solid #d1d5db;">${formatCurrency(summary.grandTotalAmount)}</td>
                      <td style="padding: 14px 8px; text-align: right; font-size: 14px; font-weight: 600; color: #dc2626; border-top: 2px solid #d1d5db;">${formatCurrency(summary.totalCommission)}</td>
                      <td style="padding: 14px 8px; text-align: right; font-size: 14px; font-weight: 700; color: #059669; border-top: 2px solid #d1d5db;">${formatCurrency(summary.totalNetAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </td>
          </tr>

          <!-- Calculation Info -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <div style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 16px;">
                <p style="margin: 0 0 8px; color: #854d0e; font-size: 14px; font-weight: 600;">정산 계산 방식</p>
                <ul style="margin: 0; padding-left: 20px; color: #713f12; font-size: 13px; line-height: 1.6;">
                  <li>공급가액 = 단가 × 수량 (배송 + 반품 + 픽업 + 기타)</li>
                  <li>부가세 = 공급가액 × 10%</li>
                  <li>합계금 = 공급가액 + 부가세</li>
                  <li>수수료 = 합계금 × ${summary.commissionRate}%</li>
                  <li>산재보험료 = 합계금 × ${summary.insuranceRate}% × 50% (본사 50% + 헬퍼 50%)</li>
                  <li>수령액 = 합계금 - 수수료 - 산재보험료 - 기타차감</li>
                </ul>
              </div>
            </td>
          </tr>

          ${bankInfo ? `
          <!-- Bank Info -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px;">
                <p style="margin: 0 0 12px; color: #166534; font-size: 14px; font-weight: 600;">지급 계좌 정보</p>
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 4px 0; color: #374151; font-size: 14px;">은행</td>
                    <td style="padding: 4px 0; color: #111827; font-size: 14px; font-weight: 500;">${bankInfo.bankName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #374151; font-size: 14px;">계좌번호</td>
                    <td style="padding: 4px 0; color: #111827; font-size: 14px; font-weight: 500;">${bankInfo.accountNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #374151; font-size: 14px;">예금주</td>
                    <td style="padding: 4px 0; color: #111827; font-size: 14px; font-weight: 500;">${bankInfo.accountHolder}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">본 정산서는 자동 발송된 문서입니다.</p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">문의사항이 있으시면 관리자에게 연락해 주세요.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateSettlementEmailSubject(year: number, month: number): string {
  return `[Hellp me] ${year}년 ${month}월 정산서`;
}
