import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function generatePDF(statement: any, residentName: string) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const width = page.getWidth();
  let y = 790;

  const drawLabelValue = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(value, { x: 220, y, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    y -= 24;
  };

  const drawCenteredText = (text: string, size: number, font: any, color: any, yPos: number) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (width - textWidth) / 2;
    page.drawText(text, { x, y: yPos, size, font, color });
  };

  drawCenteredText('LH-Connect', 20, fontBold, rgb(0.08, 0.12, 0.18), y);
  y -= 28;

  drawCenteredText('Billing Statement', 12, fontRegular, rgb(0.25, 0.25, 0.25), y);
  y -= 40;

  page.drawText('STATEMENT DETAILS', { x: 50, y, size: 11, font: fontBold });
  y -= 20;
  drawLabelValue('Statement Date:', statement.date);
  drawLabelValue('Period:', `${statement.month} ${statement.year}`);

  y -= 10;
  page.drawText('RESIDENT INFORMATION', { x: 50, y, size: 11, font: fontBold });
  y -= 20;
  drawLabelValue('Name:', residentName);

  y -= 10;
  page.drawText('BILLING SUMMARY', { x: 50, y, size: 11, font: fontBold });
  y -= 20;
  drawLabelValue('Total Dues:', `₱${statement.totalDues}`);
  drawLabelValue('Amount Paid:', `₱${statement.amountPaid}`);
  drawLabelValue('Balance:', `₱${statement.balance}`);
  drawLabelValue('Status:', statement.status);

  drawCenteredText(
    'This is a computer-generated statement. Please keep for your records.',
    8,
    fontRegular,
    rgb(0.4, 0.4, 0.4),
    40
  );

  return pdfDoc.save();
}

function generateAuditCSV(events: any[], residentName: string, title: string): string {
  const headers = ['Date', 'Description', 'Type', 'Amount', 'Status'];
  const rows = events.map((e: any) => [
    e.date,
    e.description,
    e.type,
    e.amount,
    e.status,
  ]);

  const csv = [
    `Resident: ${residentName}`,
    `Report: ${title}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    headers.join(','),
    ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}

export async function GET(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;
  const format = request.nextUrl.searchParams.get('format') || 'pdf';
  const statementId = request.nextUrl.searchParams.get('statementId');
  const reportType = request.nextUrl.searchParams.get('reportType') || 'audit';
  const year = request.nextUrl.searchParams.get('year') || new Date().getFullYear().toString();

  try {
    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const residentName = userData.fullName || userData.name || userData.email || 'Resident';

    // If specific statement requested
    if (statementId) {
      const stmtDoc = await adminDb.collection('statements').doc(statementId).get();
      let statement = stmtDoc.data() as any;

      if (!statement || statement.residentId !== userId) {
        return createErrorResponse('Statement not found', 404);
      }

      if (format === 'csv') {
        const csv = generateAuditCSV([{
          date: statement.date,
          description: `Billing Statement - ${statement.month} ${statement.year}`,
          type: 'BILL',
          amount: statement.totalDues,
          status: statement.status
        }], residentName, `Statement ${statement.month} ${statement.year}`);
        
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="statement_${statement.month}_${statement.year}.csv"`,
          },
        });
      } else {
        const pdf = await generatePDF(statement, residentName);
        return new NextResponse(new Uint8Array(pdf), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="statement_${statement.month}_${statement.year}.pdf"`,
          },
        });
      }
    }

    // Handle Bulk Reports (Audit, Daily, Monthly, Annual)
    const statementsSnapshot = await adminDb
      .collection('statements')
      .where('residentId', '==', userId)
      .where('year', '==', Number(year))
      .get();

    const submissionsSnapshot = await adminDb
      .collection('payment_submissions')
      .where('residentId', '==', userId)
      .get();

    const statements = statementsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() as any }));
    const submissions = submissionsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() as any }));

    const auditEvents: any[] = [];
    
    statements.forEach((stmt: any) => {
      auditEvents.push({
        date: stmt.date,
        description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
        type: 'BILL',
        amount: stmt.totalDues,
        status: stmt.status
      });

      // Filter submissions related to this statement
      const relatedSub = submissions.filter((sub: any) => {
        if (!sub.month) return false;
        const subMonthStr = String(sub.month).toLowerCase();
        return subMonthStr.includes(stmt.month.toLowerCase()) && subMonthStr.includes(String(stmt.year));
      });

      relatedSub.forEach((sub: any) => {
        const subDate = (sub.status === 'Verified' && sub.verifiedDate)
          ? sub.verifiedDate
          : (sub.submittedDate || stmt.date);
          
        auditEvents.push({
          date: new Date(subDate).toLocaleDateString(),
          description: `Payment Submission - ${stmt.month} ${stmt.year}`,
          type: 'PAYMENT',
          amount: sub.paymentAmount,
          status: sub.status
        });
      });
    });

    // Sort by date
    auditEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let reportTitle = "Billing History";
    let filteredEvents = auditEvents;

    if (reportType === 'daily') {
      reportTitle = `Daily Billing Activity - ${year}`;
      // Logic for daily summary could go here
    } else if (reportType === 'monthly') {
      reportTitle = `Monthly Billing Summary - ${year}`;
      // Grouping logic could go here
    } else if (reportType === 'annual') {
      reportTitle = `Annual Statement - ${year}`;
    } else {
      reportTitle = `Audit Log - ${year}`;
    }

    const csv = generateAuditCSV(filteredEvents, residentName, reportTitle);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${reportType}_report_${year}.csv"`,
      },
    });

  } catch (error: any) {
    console.error('Error generating download:', error.message);
    return createErrorResponse('Failed to generate download', 500);
  }
}
