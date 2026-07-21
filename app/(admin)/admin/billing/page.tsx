'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { apiCall } from '@/lib/api-client';
import Skeleton from '@/app/components/Skeleton';
import styles from './billing-page.module.css';
import { PrintableBilling } from './PrintableBilling';

interface Resident {
  id: string;
  name: string;
  phase: string;
  block: string;
  lot: string;
  balance: number;
}

export default function AdminBilling() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [monthYear, setMonthYear] = useState(''); // YYYY-MM format for picker
  const MONTHLY_DUE = 400;
  const [arrears, setArrears] = useState('0.00');
  const [batchArrears, setBatchArrears] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState(''); // YYYY-MM-DD format for picker
  const [isPaid, setIsPaid] = useState(false);

  // New month modal state
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const printableRef = useRef<HTMLDivElement>(null);

  // Format YYYY-MM → "MAY 2026" for the printable bill
  const formatPeriodDisplay = (val: string) => {
    if (!val) return '';
    const [year, month] = val.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  // Format YYYY-MM-DD → "May 31, 2026" for the printable bill
  const formatDueDateDisplay = (val: string) => {
    if (!val) return '';
    const [year, month, day] = val.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    // Set default month/year to current (YYYY-MM)
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    setMonthYear(`${yyyy}-${mm}`);

    // Default due date to the 15th of the current month (YYYY-MM-DD)
    setDueDate(`${yyyy}-${mm}-15`);
  }, []);

  const loadResidents = async () => {
    try {
      setIsLoading(true);
      const payload = await apiCall('/api/residents');
      const residents = (payload.residents ?? []).map((resident: any, index: number) => {
        return {
          id: resident.id ?? `R${String(index + 1).padStart(3, '0')}`,
          name: resident.fullName ?? resident.name ?? 'Unknown Resident',
          phase: resident.phase ?? 'Phase N/A',
          block: resident.block ?? '-',
          lot: resident.lot ?? '-',
          balance: Number(resident.balance ?? 0),
        } as Resident;
      });

      setAllResidents(residents);
    } catch (error) {
      console.error('Failed to load residents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResidents();
  }, []);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const filteredResidents = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    if (!normalizedTerm) {
      // If no search term, show all + move selected to top?
      // Just show all residents, order isn't changed here.
      return allResidents;
    }

    return allResidents.filter(resident => {
      // Always include the resident if they are selected
      if (selectedIds.includes(resident.id)) return true;

      // Otherwise, check if they match the search
      const name = (resident.name || '').toLowerCase();
      const address = `${resident.phase || ''} Block ${resident.block || ''}`.toLowerCase();
      return name.includes(normalizedTerm) || address.includes(normalizedTerm);
    });
  }, [allResidents, searchTerm, selectedIds]);

  // Toggle selection for a single resident
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  // Select/deselect all filtered residents
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredResidents.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Open Month Modal when Generate Bill is clicked
  const handleGenerateBillClick = () => {
    setIsMonthModalOpen(true);
  };

  const handleMonthSelect = (monthIndex: number) => {
    const yyyy = selectedYear;
    const mm = String(monthIndex + 1).padStart(2, '0');
    setMonthYear(`${yyyy}-${mm}`);
    
    // If user already selected some, use those; otherwise select all residents
    const idsToSelect = selectedIds.length > 0 ? selectedIds : allResidents.map(r => r.id);
    setSelectedIds(idsToSelect);
    
    setIsMonthModalOpen(false);

    if (idsToSelect.length === 1) {
      const resident = allResidents.find(r => r.id === idsToSelect[0]) || null;
      setSelectedResident(resident);
      setArrears(resident && resident.balance > 0 ? String(resident.balance) : '0');
    } else {
      setSelectedResident(null);
      setArrears('0');
      const initialBatchArrears: Record<string, string> = {};
      idsToSelect.forEach(id => {
        const resident = allResidents.find(r => r.id === id);
        initialBatchArrears[id] = resident && resident.balance > 0 ? String(resident.balance) : '0';
      });
      setBatchArrears(initialBatchArrears);
    }
    setIsModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedResident(null);
  };

  const numericArrears = parseFloat(arrears) || 0;
  const totalAmountDue = MONTHLY_DUE + numericArrears;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Billing Management</h1>
        <p className={styles.pageSubtitle}>Generate and print monthly dues billing for residents.</p>
      </div>

      <div className={styles.content}>
        <div className={styles.searchSection}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search resident by name or address..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {selectedIds.length > 0 && (
              <button
                className={styles.pageBtn}
                style={{ padding: '0 16px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 600, borderRadius: '8px' }}
                onClick={() => setSelectedIds([])}
                title="Clear all selected residents"
              >
                ✕ Clear ({selectedIds.length})
              </button>
            )}
            <button
              className={styles.generateBillBtn}
              onClick={handleGenerateBillClick}
              title="Select month to generate bill"
              style={{ opacity: 1, cursor: 'pointer' }}
            >
              🧾 Generate Bill
            </button>
          </div>
        </div>

        {isLoading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ marginBottom: '1rem' }}>
                <Skeleton height="40px" width="100%" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>

                    <th>Name</th>
                    <th>Address</th>
                    <th>Current Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResidents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((resident) => (
                    <tr
                      key={resident.id}
                      className={`${styles.clickableRow} ${selectedIds.includes(resident.id) ? styles.selectedRow : ''}`}
                      onClick={() => handleToggleSelect(resident.id)}
                      title="Click to select this resident"
                    >

                      <td className={styles.nameTd}>{resident.name}</td>
                      <td>
                        <div className={styles.blockLot}>
                          <span className={styles.phaseBadge}>{resident.phase}</span>
                          <span className={styles.blockLotText}>Blk {resident.block} Lot {resident.lot}</span>
                        </div>
                      </td>
                      <td>₱{resident.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {filteredResidents.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                        No residents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredResidents.length > ITEMS_PER_PAGE && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredResidents.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredResidents.length)} of {filteredResidents.length} residents
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="First page"
                  >
                    «
                  </button>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: Math.ceil(filteredResidents.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === Math.ceil(filteredResidents.length / ITEMS_PER_PAGE) || Math.abs(page - currentPage) <= 1)
                    .reduce((acc: (number | string)[], page, idx, arr) => {
                      if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
                      ) : (
                        <button
                          key={item}
                          className={`${styles.pageBtn} ${currentPage === item ? styles.pageBtnActive : ''}`}
                          onClick={() => setCurrentPage(item as number)}
                        >
                          {item}
                        </button>
                      )
                    )
                  }
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredResidents.length / ITEMS_PER_PAGE), p + 1))}
                    disabled={currentPage === Math.ceil(filteredResidents.length / ITEMS_PER_PAGE)}
                  >
                    Next ›
                  </button>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(Math.ceil(filteredResidents.length / ITEMS_PER_PAGE))}
                    disabled={currentPage === Math.ceil(filteredResidents.length / ITEMS_PER_PAGE)}
                    title="Last page"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Generate Bill {!selectedResident && '(Batch)'}</h2>
              <button className={styles.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.residentInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Resident:</span>
                  <span className={styles.infoValue}>{selectedResident ? selectedResident.name : `Multiple Residents (${selectedIds.length})`}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Address:</span>
                  <span className={styles.infoValue}>{selectedResident ? `${selectedResident.phase} Blk ${selectedResident.block} Lot ${selectedResident.lot}` : 'Various Addresses'}</span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Period Covered</label>
                <input
                  type="month"
                  className={`${styles.formInput} ${styles.calendarInput}`}
                  value={monthYear}
                  onChange={e => setMonthYear(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Monthly Due (₱)</label>
                <div className={styles.staticField}>
                  <span className={styles.staticAmount}>₱ 400.00</span>
                  <span className={styles.staticBadge}>Fixed Rate</span>
                </div>
              </div>

              {selectedResident ? (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Arrears (₱)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={arrears}
                    onChange={e => setArrears(e.target.value)}
                    step="400"
                    min="0"
                  />
                </div>
              ) : (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Individual Arrears (₱)</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem', background: '#fafafa' }}>
                    {allResidents.filter(r => selectedIds.includes(r.id)).map(res => (
                      <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#374151', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '65%' }} title={res.name}>
                          {res.name}
                        </span>
                        <input
                          type="number"
                          className={styles.formInput}
                          style={{ width: '100px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                          value={batchArrears[res.id] || ''}
                          onChange={e => setBatchArrears(prev => ({ ...prev, [res.id]: e.target.value }))}
                          step="400"
                          min="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Due Date</label>
                <input
                  type="date"
                  className={`${styles.formInput} ${styles.calendarInput}`}
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              <div className={styles.formGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isPaid"
                  checked={isPaid}
                  onChange={e => setIsPaid(e.target.checked)}
                  style={{ width: '1rem', height: '1rem' }}
                />
                <label htmlFor="isPaid" className={styles.formLabel} style={{ cursor: 'pointer', margin: 0 }}>
                  Mark as PAID
                </label>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
              <button className={styles.generateBtn} onClick={handlePrint}>
                🖨️ Print Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Month Selection Modal */}
      {isMonthModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsMonthModalOpen(false)}>
          <div className={styles.modalContent} style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Select Billing Month</h2>
              <button className={styles.closeBtn} onClick={() => setIsMonthModalOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button 
                  onClick={() => setSelectedYear(y => y - 1)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#4b5563' }}
                >
                  ◀
                </button>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937' }}>{selectedYear}</h3>
                <button 
                  onClick={() => setSelectedYear(y => y + 1)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#4b5563' }}
                >
                  ▶
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map((month, index) => {
                  const currentYear = new Date().getFullYear();
                  const currentMonth = new Date().getMonth();
                  const isDisabled = selectedYear > currentYear || (selectedYear === currentYear && index > currentMonth);

                  return (
                  <button
                    key={month}
                    disabled={isDisabled}
                    onClick={() => handleMonthSelect(index)}
                    style={{
                      padding: '12px 8px',
                      background: isDisabled ? '#f9fafb' : '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      color: isDisabled ? '#9ca3af' : '#374151',
                      opacity: isDisabled ? 0.6 : 1,
                      filter: isDisabled ? 'blur(0.5px)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.background = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#c7d2fe';
                        e.currentTarget.style.color = '#4338ca';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.color = '#374151';
                      }
                    }}
                  >
                    {month}
                  </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print view */}
      {isModalOpen && (
        <div className={styles.printView}>
          <PrintableBilling
            ref={printableRef}
            bills={
              selectedResident
                ? [{
                    residentName: selectedResident.name,
                    blockLot: `${selectedResident.phase} Blk. ${selectedResident.block} Lot ${selectedResident.lot}`,
                    periodCovered: formatPeriodDisplay(monthYear),
                    monthlyDueBill: MONTHLY_DUE,
                    arrears: numericArrears,
                    totalAmountDue: totalAmountDue,
                    dueDate: formatDueDateDisplay(dueDate),
                    isPaid: isPaid
                  }]
                : allResidents.filter(r => selectedIds.includes(r.id)).map(res => {
                    const resArrearsVal = parseFloat(batchArrears[res.id]) || 0;
                    return {
                      residentName: res.name,
                      blockLot: `${res.phase} Blk. ${res.block} Lot ${res.lot}`,
                      periodCovered: formatPeriodDisplay(monthYear),
                      monthlyDueBill: MONTHLY_DUE,
                      arrears: resArrearsVal,
                      totalAmountDue: MONTHLY_DUE + resArrearsVal,
                      dueDate: formatDueDateDisplay(dueDate),
                      isPaid: isPaid
                    };
                  })
            }
          />
        </div>
      )}
    </div>
  );
}
