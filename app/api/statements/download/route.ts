import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
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

function generateCSV(statements: any[], residentName: string): string {
  const headers = ['Date', 'Month', 'Year', 'Total Dues', 'Amount Paid', 'Balance', 'Status'];
  const rows = statements.map((s) => [
    s.date,
    s.month,
    s.year,
    s.totalDues,
    s.amountPaid,
    s.balance,
    s.status,
  ]);

  const csv = [
    `Resident: ${residentName}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;
  const format = request.nextUrl.searchParams.get('format') || 'pdf';
  const statementId = request.nextUrl.searchParams.get('statementId');

  try {
    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    if (userData.role !== 'resident') {
      return createErrorResponse('Only residents can download statements', 403);
    }

    const residentName = userData.name || userData.email || 'Resident';

    // If specific statement requested
    if (statementId) {
      const stmtDoc = await adminDb.collection('statements').doc(statementId).get();
      let statement = stmtDoc.data() as any;

      if (!statement || statement.residentId !== userId) {
        return createErrorResponse('Statement not found', 404);
      }

      if (format === 'csv') {
        const csv = generateCSV([statement], residentName);
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

    // Download all statements
    try {
      const statementsSnapshot = await adminDb
        .collection('statements')
        .where('residentId', '==', userId)
        .get();

      const statements = statementsSnapshot.docs.map((doc: any) => doc.data());

      if (statements.length === 0) {
        return createErrorResponse('No statements found', 404);
      }

      if (format === 'csv') {
        const csv = generateCSV(statements, residentName);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="all_statements.csv"`,
          },
        });
      } else {
        // For multiple PDFs, return a summary from the latest statement.
        const pdf = await generatePDF(statements[0], residentName);
        return new NextResponse(new Uint8Array(pdf), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="statements_summary.pdf"`,
          },
        });
      }
    } catch (error: any) {
      console.warn('Firestore query error:', error.message);
      return createErrorResponse('No statements found', 404);
    }
  } catch (error: any) {
    console.error('Error generating download:', error.message);
    return createErrorResponse('Failed to generate download', 500);
  }
}
