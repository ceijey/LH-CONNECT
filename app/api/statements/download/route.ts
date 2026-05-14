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

async function generateAuditPDF(events: any[], residentName: string, title: string) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const width = page.getWidth();
  const height = page.getHeight();
  let y = 790;

  const drawCenteredText = (text: string, size: number, font: any, color: any, yPos: number, currentPage: any) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (width - textWidth) / 2;
    currentPage.drawText(text, { x, y: yPos, size, font, color });
  };

  // --- PROFESSIONAL HEADER ---
  page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: rgb(0.96, 0.97, 0.98) });
  
  page.drawText('LH-Connect', { x: 50, y: height - 45, size: 24, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  
  const address = 'San Pablo Dinalupihan Bataan';
  const tin = 'TIN: 480-266-103-000';
  page.drawText(address, { x: width - 50 - fontRegular.widthOfTextAtSize(address, 10), y: height - 40, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(tin, { x: width - 50 - fontRegular.widthOfTextAtSize(tin, 10), y: height - 55, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

  y = height - 130;
  drawCenteredText(title.toUpperCase(), 16, fontBold, rgb(0.15, 0.15, 0.15), y, page);
  y -= 30;

  page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 25;
  
  page.drawText('RESIDENT NAME:', { x: 50, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(residentName, { x: 140, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  
  const reportDate = `REPORT DATE: ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`;
  page.drawText(reportDate, { x: width - 50 - fontRegular.widthOfTextAtSize(reportDate, 9), y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  
  y -= 40;

  // Table Headers
  const cols = [
    { label: 'DATE', x: 50, w: 80 },
    { label: 'DESCRIPTION', x: 140, w: 210 },
    { label: 'TYPE', x: 360, w: 50 },
    { label: 'AMOUNT', x: 420, w: 70, align: 'right' },
    { label: 'STATUS', x: 500, w: 60 }
  ];

  page.drawRectangle({ x: 45, y: y - 5, width: width - 90, height: 22, color: rgb(0.1, 0.2, 0.4) });
  cols.forEach(col => {
    page.drawText(col.label, { x: col.x, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  });
  y -= 30;

  // Table Rows
  events.forEach((event, index) => {
    if (y < 80) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 790;
      page.drawRectangle({ x: 45, y: y - 5, width: width - 90, height: 20, color: rgb(0.1, 0.2, 0.4) });
      cols.forEach(col => { page.drawText(col.label, { x: col.x, y, size: 9, font: fontBold, color: rgb(1, 1, 1) }); });
      y -= 25;
    }

    if (index % 2 === 1) {
      page.drawRectangle({ x: 45, y: y - 5, width: width - 90, height: 18, color: rgb(0.97, 0.98, 1.0) });
    }

    page.drawText(event.date, { x: 50, y, size: 9, font: fontRegular });
    page.drawText(event.description, { x: 140, y, size: 9, font: fontRegular });
    page.drawText(event.type, { x: 360, y, size: 9, font: fontRegular });
    
    const amountText = `${event.type === 'BILL' ? '+' : '-'} P${event.amount.toLocaleString()}`;
    const amountWidth = fontRegular.widthOfTextAtSize(amountText, 9);
    page.drawText(amountText, { x: 490 - amountWidth, y, size: 9, font: fontBold, color: event.type === 'BILL' ? rgb(0.7, 0.1, 0.1) : rgb(0.1, 0.5, 0.1) });
    page.drawText(event.status, { x: 500, y, size: 8, font: fontItalic, color: rgb(0.4, 0.4, 0.4) });
    
    y -= 18;
  });

  y -= 40;

  // --- ANALYTICS TABLE ---
  if (y < 150) {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = 790;
  }

  const totalBilled = events.filter(e => e.type === 'BILL').reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = events.filter(e => e.type === 'PAYMENT' && (e.status === 'Confirmed' || e.status === 'Verified')).reduce((sum, e) => sum + e.amount, 0);
  const netBalance = totalBilled - totalPaid;

  const summaryX = 50;
  page.drawText('FINANCIAL SUMMARY', { x: summaryX, y, size: 11, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  y -= 20;

  // Draw Summary Table
  const drawSummaryRow = (label: string, value: string, isLast = false) => {
    page.drawRectangle({ x: summaryX, y: y - 5, width: width - 100, height: 20, color: isLast ? rgb(0.95, 0.95, 0.98) : rgb(1, 1, 1) });
    page.drawText(label, { x: summaryX + 10, y, size: 10, font: isLast ? fontBold : fontRegular });
    const valWidth = (isLast ? fontBold : fontRegular).widthOfTextAtSize(value, 10);
    page.drawText(value, { x: width - 60 - valWidth, y, size: 10, font: isLast ? fontBold : fontRegular, color: isLast ? rgb(0.8, 0, 0) : rgb(0, 0, 0) });
    y -= 20;
  };

  drawSummaryRow('Total Billed Amount', `P${totalBilled.toLocaleString()}`);
  drawSummaryRow('Total Paid Amount', `P${totalPaid.toLocaleString()}`);
  drawSummaryRow('CURRENT NET BALANCE', `P${netBalance.toLocaleString()}`, true);

  // --- PROFESSIONAL FOOTER ---
  const footerY = 40;
  page.drawRectangle({ x: 50, y: footerY + 15, width: width - 100, height: 0.5, color: rgb(0.7, 0.7, 0.7) });
  drawCenteredText('LH-Connect community management • San Pablo Dinalupihan Bataan • TIN: 480-266-103-000', 8, fontItalic, rgb(0.5, 0.5, 0.5), footerY, page);

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
    let statementsQuery: any = adminDb.collection('statements').where('residentId', '==', userId);
    
    if (reportType !== 'audit') {
      statementsQuery = statementsQuery.where('year', '==', Number(year));
    }
    
    const statementsSnapshot = await statementsQuery.get();

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
      const today = new Date();
      const todayStr = today.toLocaleDateString();
      reportTitle = `Daily Activity Report - ${todayStr}`;
      
      filteredEvents = auditEvents.filter(e => {
        const eDate = new Date(e.date);
        return eDate.getDate() === today.getDate() &&
               eDate.getMonth() === today.getMonth() &&
               eDate.getFullYear() === today.getFullYear();
      });
    } else if (reportType === 'audit') {
      reportTitle = "Full Activity History (All Years)";
      // Note: We already have the events for the current year, 
      // but the user expects EVERYTHING for 'audit'.
      // For simplicity, we'll keep the current fetch but ensure it's labeled correctly.
      // If we want TRUE full history, we'd remove the .where('year') above.
    } else if (reportType === 'monthly') {
      reportTitle = `Monthly Billing Summary - ${year}`;
    } else if (reportType === 'annual') {
      reportTitle = `Annual Statement - ${year}`;
    }

    if (format === 'csv') {
      const csv = generateAuditCSV(filteredEvents, residentName, reportTitle);
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${reportType}_report_${year}.csv"`,
        },
      });
    } else {
      const pdf = await generateAuditPDF(filteredEvents, residentName, reportTitle);
      
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${reportType}_report_${year}.pdf"`,
        },
      });
    }

  } catch (error: any) {
    console.error('Error generating download:', error.message);
    return createErrorResponse('Failed to generate download', 500);
  }
}
