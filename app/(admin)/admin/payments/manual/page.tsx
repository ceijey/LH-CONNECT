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
  const [lineItems, setLineItems] = useState(
    Array.from({ length: 6 }, () => ({ natureOfService: '', quantity: '', unitPrice: '' }))
  );
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

    // Default month to current (format: YYYY-MM for input type="month")
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setMonth(currentMonth);
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
    window.print();
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
                    <p className={styles.invoiceText}>NON-VAT REG. TIN: 480-266-103-00000</p>
                    <p className={styles.invoiceText}>Purok 3 Lincoln Heights Subdivision, San Pablo, Dinalupihan, Bataan, Philippines 2110</p>
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
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className={styles.tableInput}
                                value={item.quantity}
                                onChange={(e) => handleLineItemChange(rowIndex, 'quantity', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className={styles.tableInput}
                                value={item.unitPrice}
                                onChange={(e) => handleLineItemChange(rowIndex, 'unitPrice', e.target.value)}
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

      <section className={styles.printArea}>
        <div className={styles.printGrid}>
          {Array.from({ length: 6 }).map((_, copyIndex) => (
            <div key={copyIndex} className={`${styles.invoicePaper} ${styles.printInvoice}`}>
              <div className={styles.invoiceHeader}>
                <div className={styles.invoiceBrand}>
                  <h2 className={styles.invoiceTitle}>LINCOLN HEIGHTS HOMEOWNERS ASSOCIATION INC.</h2>
                  <p className={styles.invoiceText}>NON-VAT REG. TIN: 480-266-103-00000</p>
                  <p className={styles.invoiceText}>Purok 3 Lincoln Heights Subdivision, San Pablo, Bataan, Philippines 2110</p>
                </div>
                <div className={styles.invoiceLabel}>
                  <span className={styles.invoiceLabelTag}>SERVICE</span>
                  <h3 className={styles.invoiceLabelTitle}>INVOICE</h3>
                </div>
              </div>

              <div className={styles.invoiceMetaRow}>
                <div className={styles.printCheckboxGroup}>
                  <span className={styles.printCheckbox}>{cashSaleChecked ? '☑' : '☐'} CASH SALES</span>
                  <span className={styles.printCheckbox}>{chargeSaleChecked ? '☑' : '☐'} CHARGE SALES</span>
                </div>
                <div className={styles.invoiceFieldRow}>
                  <span className={styles.invoiceFieldLabel}>Invoice No.</span>
                  <div className={styles.printValue}>{invoiceNumber || '_____________________'}</div>
                </div>
                <div className={styles.invoiceFieldRow}>
                  <span className={styles.invoiceFieldLabel}>Date</span>
                  <div className={styles.printValue}>{formattedPrintDate || '____/__/____'}</div>
                </div>
              </div>

              <div className={styles.soldToSection}>
                <div className={styles.soldToLabel}>SOLD TO:</div>
                <div className={styles.soldToGrid}>
                  <div className={styles.printSoldRow}>
                    <span className={styles.soldToRowLabel}>Registered Name:</span>
                    <div className={styles.printValue}>{registeredName || '_________________________________'}</div>
                  </div>
                  <div className={styles.printSoldRow}>
                    <span className={styles.soldToRowLabel}>TIN:</span>
                    <div className={styles.printValue}>{tin || '_____________________'}</div>
                  </div>
                  <div className={styles.printSoldRowFull}>
                    <span className={styles.soldToRowLabel}>Business Address:</span>
                    <div className={styles.printValue}>{businessAddress || '_________________________________'}</div>
                  </div>
                </div>
              </div>

              <div className={styles.invoiceTableWrapper}>
                <table className={styles.invoiceTable}>
                  <thead>
                    <tr>
                      <th>Nature of Service</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, rowIndex) => {
                      const itemAmount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                      return (
                        <tr key={`print-item-${copyIndex}-${rowIndex}`}>
                          <td className={styles.printTableCell}>{item.natureOfService || ''}</td>
                          <td className={styles.printTableCell}>{item.quantity || ''}</td>
                          <td className={styles.printTableCell}>{item.unitPrice ? `₱${Number(item.unitPrice).toLocaleString()}` : ''}</td>
                          <td className={styles.printTableCell}>{itemAmount ? `₱${itemAmount.toLocaleString()}` : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.printSummaryRow}>
                  <span>Total Sale</span>
                  <span>₱{saleAmount.toLocaleString()}</span>
                </div>
                <div className={styles.printSummaryRow}>
                  <span>Discount for PWD</span>
                  <span>₱{Number(discountPwd).toLocaleString()}</span>
                </div>
                <div className={styles.printSummaryRow}>
                  <span>Less Withholding Tax</span>
                  <span>₱{Number(withholdingTax).toLocaleString()}</span>
                </div>
                <div className={styles.printSummaryRowTotal}>
                  <span>Total Amount Due</span>
                  <span>₱{totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className={styles.printFooter}>
                <p className={styles.printNote}>THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
