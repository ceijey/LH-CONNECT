'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './manual-payment.module.css';
import { apiCall } from '@/lib/api-client';

interface Resident {
  id: string;
  fullName: string;
  phase?: string;
  block?: string;
  lot?: string;
  email?: string;
}

export default function ManualPaymentPage() {
  const router = useRouter();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [amount] = useState('400');
  const [cashSale, setCashSale] = useState('400');
  const [chargeSale, setChargeSale] = useState('0');
  const [cashSaleChecked, setCashSaleChecked] = useState(true);
  const [chargeSaleChecked, setChargeSaleChecked] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dateSoldTo, setDateSoldTo] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [tin, setTin] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [lineItems, setLineItems] = useState([
    { natureOfService: 'Monthly Dues', quantity: '1', unitPrice: '400' },
    { natureOfService: '', quantity: '', unitPrice: '' },
    { natureOfService: '', quantity: '', unitPrice: '' },
    { natureOfService: '', quantity: '', unitPrice: '' },
    { natureOfService: '', quantity: '', unitPrice: '' },
    { natureOfService: '', quantity: '', unitPrice: '' }
  ]);
  const [discountPwd, setDiscountPwd] = useState('0');
  const [withholdingTax, setWithholdingTax] = useState('0');
  const [month, setMonth] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchResidents = async () => {
      try {
        const data = await apiCall('/api/residents');
        setResidents(data.residents || []);
      } catch (err) {
        console.error('Failed to fetch residents:', err);
      }
    };
    fetchResidents();

    // Default month to current (format: YYYY-MM for input type="month") and date to today (format: YYYY-MM-DD)
    const now = new Date();
    const year = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = String(now.getDate()).padStart(2, '0');
    const currentMonth = `${year}-${monthStr}`;
    const today = `${year}-${monthStr}-${dayStr}`;
    setMonth(currentMonth);
    setDateSoldTo(today);
  }, []);

  const filteredResidents = residents.filter(r => 
    r.fullName.toLowerCase().includes(registeredName.toLowerCase())
  );

  const selectedResident = residents.find(r => r.id === selectedResidentId);
  const saleAmount = lineItems.reduce((sum, item) => {
    const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    return sum + itemTotal;
  }, 0);
  const totalAmount = saleAmount - Number(discountPwd || 0) - Number(withholdingTax || 0);

  const handleLineItemChange = (index: number, field: 'natureOfService' | 'quantity' | 'unitPrice', value: string) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleSelectResident = (resident: Resident) => {
    setSelectedResidentId(resident.id);
    setRegisteredName(resident.fullName);
    setShowResults(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!selectedResidentId || !amount || !month) {
      setError('Please select a resident and billing period.');
      setIsSubmitting(false);
      return;
    }

    // Format month for display/database (e.g. "May 2026")
    const [year, monthNum] = month.split('-');
    const dateObj = new Date(Number(year), Number(monthNum) - 1);
    const formattedMonth = dateObj.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    try {
      await apiCall('/api/admin/manual-payment', {
        method: 'POST',
        body: JSON.stringify({
          residentId: selectedResidentId,
          paymentAmount: Number(amount),
          month: formattedMonth,
          notes,
          paymentMethod: 'Cash',
          cashSale: Number(cashSale),
          chargeSale: Number(chargeSale),
          invoiceNumber,
          dateSoldTo,
          registeredName,
          tin,
          businessAddress,
          invoiceItems: lineItems.map(item => ({
            natureOfService: item.natureOfService,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            amount: Number(item.quantity || 0) * Number(item.unitPrice || 0),
          })),
          totalSale: saleAmount,
          discountPwd: Number(discountPwd),
          withholdingTax: Number(withholdingTax),
          totalAmount,
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/payments');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedPrintDate = dateSoldTo ? new Date(dateSoldTo).toLocaleDateString('en-GB') : '';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print invoices.');
      return;
    }

    const invoiceTitle = cashSaleChecked ? 'CASH SALE INVOICE' : chargeSaleChecked ? 'CHARGE SALE INVOICE' : 'SERVICE INVOICE';
    const invoiceNum = invoiceNumber || 'N/A';
    const invoiceDate = formattedPrintDate || 'N/A';
    const clientName = registeredName || 'Resident';
    const clientAddress = businessAddress || 'N/A';

    // Get non-empty line items
    const activeItems = lineItems.filter(item => item.natureOfService.trim() !== '');
    if (activeItems.length === 0) {
      activeItems.push({ natureOfService: 'Monthly Dues', quantity: '1', unitPrice: '400' });
    }

    const tableRowsHtml = activeItems.map(item => {
      const qty = item.quantity || '1';
      const price = Number(item.unitPrice || 0);
      const amount = Number(qty) * price;
      return `
        <tr>
          <td style="font-weight: 700;">${item.natureOfService}</td>
          <td style="text-align: center;">${qty}</td>
          <td style="text-align: right;">₱${price.toLocaleString()}</td>
          <td style="font-weight: 800; text-align: right;">₱${amount.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const discountHtml = Number(discountPwd) > 0 ? `
      <div class="summary-row">
        <span>PWD Discount</span>
        <span>-₱${Number(discountPwd).toLocaleString()}</span>
      </div>
    ` : '';

    const taxHtml = Number(withholdingTax) > 0 ? `
      <div class="summary-row">
        <span>Withholding Tax</span>
        <span>-₱${Number(withholdingTax).toLocaleString()}</span>
      </div>
    ` : '';

    const copiesHtml = Array.from({ length: 6 }).map((_, copyIndex) => `
      <div class="invoice-box">
        <div class="print-header">
          <div class="print-logo-section">
            <img src="/lhhoa-logo.png" alt="LH Logo" class="print-logo-img" />
            <span class="print-logo-text">LH-CONNECT</span>
          </div>
          <div class="print-subtitle">
            LINCOLN HEIGHTS SUBD., SAN PABLO, DINALUPIHAN, BATAAN • TIN: 420-968-199-000
          </div>
        </div>
        
        <div class="print-divider"></div>

        <h2 class="print-invoice-title">${invoiceTitle}</h2>

        <div class="print-profile-info">
          <div class="print-info-grid">
            <div>
              <div class="print-info-item">
                <span class="print-info-label">Invoice No:</span>
                <span class="print-info-value">${invoiceNum}</span>
              </div>
              <div class="print-info-item" style="margin-top: 2px;">
                <span class="print-info-label">Date:</span>
                <span class="print-info-value">${invoiceDate}</span>
              </div>
            </div>
            <div>
              <div class="print-info-item">
                <span class="print-info-label">Sold To:</span>
                <span class="print-info-value">${clientName}</span>
              </div>
              <div class="print-info-item" style="margin-top: 2px;">
                <span class="print-info-label">Address:</span>
                <span class="print-info-value">${clientAddress}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="print-table-wrapper">
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 50%;">NATURE OF SERVICE</th>
                <th style="width: 10%; text-align: center;">QTY</th>
                <th style="width: 20%; text-align: right;">PRICE</th>
                <th style="width: 20%; text-align: right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>

        <div class="print-summary">
          <div class="summary-row">
            <span>Total Sale</span>
            <span>₱${saleAmount.toLocaleString()}</span>
          </div>
          ${discountHtml}
          ${taxHtml}
          <div class="summary-row total-row">
            <span>Total Amount Due</span>
            <span>₱${totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <div class="print-footer">
          <div class="not-valid">THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.</div>
          <div class="copyright">LINCOLN HEIGHTS HOMEOWNERS ASSOCIATION © 2026. ALL RIGHTS RESERVED.</div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${invoiceTitle} - ${invoiceNum}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            @page {
              size: A4 portrait;
              margin: 5mm;
            }
            body {
              font-family: 'Inter', system-ui, sans-serif;
              margin: 0;
              padding: 0;
              background: white;
              color: #1e293b;
              box-sizing: border-box;
            }
            .print-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(3, 1fr);
              gap: 4mm;
              width: 200mm;
              height: 287mm;
              box-sizing: border-box;
              padding: 2mm;
            }
            .invoice-box {
              border: 1px dashed #64748b;
              border-radius: 8px;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: white;
              box-sizing: border-box;
              overflow: hidden;
              height: 93mm;
            }
            .print-header {
              text-align: center;
              margin-bottom: 1px;
            }
            .print-logo-section {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
            }
            .print-logo-img {
              width: 14px;
              height: 14px;
              object-fit: contain;
            }
            .print-logo-text {
              font-size: 10px;
              font-weight: 800;
              color: #1B2A4A;
              letter-spacing: -0.01em;
            }
            .print-subtitle {
              font-size: 6px;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              margin-top: 1px;
              font-weight: 600;
            }
            .print-divider {
              border-bottom: 1.5px solid #1B2A4A;
              margin: 2px 0 3px;
            }
            .print-invoice-title {
              font-size: 8.5px;
              font-weight: 800;
              text-align: center;
              margin: 1px 0 3px;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
            .print-profile-info {
              font-size: 7.2px;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 3px 5px;
              background: #f8fafc;
              margin-bottom: 3px;
            }
            .print-info-grid {
              display: grid;
              grid-template-columns: 1fr 1.2fr;
              gap: 2px 8px;
            }
            .print-info-item {
              display: flex;
              justify-content: space-between;
              border-bottom: 1px dashed #cbd5e1;
              padding-bottom: 1px;
            }
            .print-info-label {
              font-weight: 700;
              color: #475569;
            }
            .print-info-value {
              font-weight: 600;
              color: #0f172a;
              text-align: right;
            }
            .print-table-wrapper {
              margin-bottom: 3px;
              flex-grow: 1;
            }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 7.2px;
            }
            .print-table th {
              text-align: left;
              padding: 2px;
              color: #94a3b8;
              text-transform: uppercase;
              font-weight: 700;
              font-size: 6.2px;
              border-bottom: 1.5px solid #cbd5e1;
            }
            .print-table td {
              padding: 2px;
              border-bottom: 1px solid #f1f5f9;
              color: #0f172a;
            }
            .print-summary {
              display: grid;
              gap: 1.5px;
              font-size: 7.2px;
              margin-bottom: 3px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              color: #475569;
            }
            .total-row {
              font-weight: 800;
              color: #1e3a8a;
              border-top: 1px solid #cbd5e1;
              padding-top: 1.5px;
            }
            .print-footer {
              text-align: center;
              margin-top: auto;
            }
            .not-valid {
              font-size: 4.8px;
              font-weight: 700;
              color: #94a3b8;
              text-transform: uppercase;
            }
            .copyright {
              font-size: 4.8px;
              color: #cbd5e1;
              text-transform: uppercase;
              font-weight: 600;
              margin-top: 1px;
            }
          </style>
        </head>
        <body>
          <div class="print-grid">
            ${copiesHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={styles.container}>
      {success && (
        <div className={styles.successOverlay}>
          <div className={styles.successIcon}>🎉</div>
          <h2 className={styles.successTitle}>Payment Recorded!</h2>
          <p className={styles.successMsg}>The resident has been notified and the receipt is ready.</p>
        </div>
      )}

      <div className={styles.noPrint}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.headerTag}>ADMIN • Manual Payment</span>
            <span className={styles.statusBadge}>Cash payment</span>
          </div>
          <div className={styles.headerMain}>
            <h1 className={styles.title}>Manual Payment</h1>
            <p className={styles.subtitle}>Record a cash payment from a resident and generate an instant receipt instantly.</p>
          </div>
        </header>

      <form onSubmit={handleSubmit}>
        <div className={styles.card}>
          {error && (
            <div className={styles.error}>
              <span>⚠️</span> {error}
            </div>
          )}

          <div className={styles.cardBody}>
            <div className={styles.fullWidth}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>Invoice details</p>
                  <h2 className={styles.sectionTitle}>Cash / charge sale summary</h2>
                </div>
              </div>

              <div className={styles.invoicePaper}>
                <div className={styles.invoiceHeader}>
                  <div className={styles.invoiceBrand}>
                    <h2 className={styles.invoiceTitle}>LINCOLN HEIGHTS HOMEOWNERS ASSOCIATION INC.</h2>
                    <p className={styles.invoiceText}>NON-VAT REG. TIN: 420-968-199-000</p>
                    <p className={styles.invoiceText}>Lincoln Heights Subd., San Pablo, Dinalupihan, Bataan</p>
                  </div>
                  <div className={styles.invoiceLabel}>
                    <span className={styles.invoiceLabelTag}>SERVICE</span>
                    <h3 className={styles.invoiceLabelTitle}>INVOICE</h3>
                  </div>
                </div>

                <div className={styles.invoiceMetaRow}>
                  <div className={styles.invoiceCheckboxGroup}>
                    <label className={styles.invoiceCheckbox}>
                      <input
                        type="checkbox"
                        checked={cashSaleChecked}
                        onChange={() => {
                          setCashSaleChecked(!cashSaleChecked);
                          if (cashSaleChecked) setCashSale('0');
                          else if (chargeSale === '0') setCashSale('400');
                        }}
                      />
                      Cash Sale
                    </label>
                    <label className={styles.invoiceCheckbox}>
                      <input
                        type="checkbox"
                        checked={chargeSaleChecked}
                        onChange={() => {
                          setChargeSaleChecked(!chargeSaleChecked);
                          if (chargeSaleChecked) setChargeSale('0');
                          else if (cashSale === '0') setChargeSale('400');
                        }}
                      />
                      Charge Sale
                    </label>
                  </div>
                  <div className={styles.invoiceFieldRow}>
                    <label className={styles.invoiceFieldLabel}>Invoice No.</label>
                    <input
                      type="text"
                      className={styles.tableInput}
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                  <div className={styles.invoiceFieldRow}>
                    <label className={styles.invoiceFieldLabel}>Date</label>
                    <input
                      type="date"
                      className={styles.tableInput}
                      value={dateSoldTo}
                      onChange={(e) => setDateSoldTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.soldToSection}>
                  <div className={styles.soldToLabel}>SOLD TO:</div>
                  <div className={styles.soldToGrid}>
                    <div className={styles.soldToRow}>
                      <label className={styles.soldToRowLabel}>Registered Name:</label>
                      <div className={styles.searchContainer}>
                        <input
                          type="text"
                          className={styles.tableInput}
                          value={registeredName}
                          onChange={(e) => {
                            setRegisteredName(e.target.value);
                            setShowResults(true);
                            if (selectedResidentId) setSelectedResidentId('');
                          }}
                          onFocus={() => setShowResults(true)}
                          placeholder="Type resident name..."
                        />
                        {showResults && registeredName.length > 0 && (
                          <div className={styles.resultsList}>
                            {filteredResidents.length > 0 ? (
                              filteredResidents.map(r => (
                                <div
                                  key={r.id}
                                  className={styles.resultItem}
                                  onClick={() => handleSelectResident(r)}
                                >
                                  <span className={styles.resultName}>{r.fullName}</span>
                                  <span className={styles.resultAddr}>Ph{r.phase} B{r.block} L{r.lot}</span>
                                </div>
                              ))
                            ) : (
                              <div className={styles.noResults}>No residents found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.soldToRow}>
                      <label className={styles.soldToRowLabel}>TIN:</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={20}
                        className={styles.tableInput}
                        placeholder="Numbers only"
                        value={tin}
                        onChange={(e) => setTin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div className={styles.soldToRowFull}>
                      <label className={styles.soldToRowLabel}>Business Address:</label>
                      <input
                        type="text"
                        className={styles.tableInput}
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.invoiceTableWrapper}>
                  <table className={styles.invoiceTable}>
                    <thead>
                      <tr>
                        <th>Nature of Service</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, rowIndex) => {
                        const itemAmount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                        return (
                          <tr key={`item-row-${rowIndex}`}>
                            <td>
                              <input
                                type="text"
                                className={styles.tableInput}
                                value={item.natureOfService}
                                onChange={(e) => handleLineItemChange(rowIndex, 'natureOfService', e.target.value)}
                                disabled={rowIndex === 0}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className={styles.tableInput}
                                value={item.quantity}
                                onChange={(e) => handleLineItemChange(rowIndex, 'quantity', e.target.value)}
                                disabled={rowIndex === 0}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className={styles.tableInput}
                                value={item.unitPrice}
                                onChange={(e) => handleLineItemChange(rowIndex, 'unitPrice', e.target.value)}
                                disabled={rowIndex === 0}
                              />
                            </td>
                            <td>
                              <div className={styles.staticCell}>₱{itemAmount.toLocaleString()}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={styles.summaryGrid}>
                  <div className={styles.summaryRow}>
                    <span>Total Sale</span>
                    <span>₱{saleAmount.toLocaleString()}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Discount for PWD</span>
                    <input
                      type="number"
                      min="0"
                      className={styles.tableInput}
                      value={discountPwd}
                      onChange={(e) => setDiscountPwd(e.target.value)}
                    />
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Less Withholding Tax</span>
                    <input
                      type="number"
                      min="0"
                      className={styles.tableInput}
                      value={withholdingTax}
                      onChange={(e) => setWithholdingTax(e.target.value)}
                    />
                  </div>
                  <div className={styles.summaryRowTotal}>
                    <span>Total Amount Due</span>
                    <span>₱{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.fullWidth}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>Notes</p>
                  <h2 className={styles.sectionTitle}>Payment reference</h2>
                </div>
                <p className={styles.sectionNote}>Add optional notes for the receipt or admin record.</p>
              </div>

              <div className={styles.formGroup}>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  placeholder="e.g. Cash payment made at admin office, reference memo #123..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.printBtn}
            onClick={handlePrint}
            disabled={isSubmitting}
          >
            Print Invoice
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : '💵 Record Cash Payment'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
