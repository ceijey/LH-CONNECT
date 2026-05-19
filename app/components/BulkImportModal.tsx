'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { apiCall } from '@/lib/api-client';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedResident {
  NAME: string;
  BLK: string;
  LOT: string;
  email?: string;
  phone?: string;
  isValid: boolean;
  validationError?: string;
}

interface ImportResult {
  name: string;
  email: string;
  status: 'success' | 'failed';
  error?: string;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [defaultPhase, setDefaultPhase] = useState('NEW AREA & SOCIALIZED');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedResident[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  
  const [importSummary, setImportSummary] = useState<{
    successCount: number;
    failedCount: number;
    results: ImportResult[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Browser-side robust CSV and Excel parsing using SheetJS
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setErrorMessage(null);
    setImportSummary(null);
    setImportProgress(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Parse sheet to JSON array (header: 1 returns array of arrays)
        const jsonRows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
        if (jsonRows.length < 2) {
          setErrorMessage('File must contain a header row and at least one data row.');
          return;
        }

        // Dynamic scanner: find the header row containing NAME, BLK (or BLOCK/B L K), and LOT
        let headerRowIdx = -1;
        let nameIdx = -1;
        let blkIdx = -1;
        let lotIdx = -1;
        let emailIdx = -1;
        let phoneIdx = -1;

        for (let r = 0; r < jsonRows.length; r++) {
          const row = jsonRows[r];
          if (!row || !Array.isArray(row)) continue;

          // Normalize values: trim whitespace, strip internal spaces, convert to uppercase
          const normalizedVals = row.map(v => String(v || '').trim().replace(/\s+/g, '').toUpperCase());

          const tempNameIdx = normalizedVals.findIndex(h => h === 'NAME' || h === 'FULLNAME');
          const tempBlkIdx = normalizedVals.findIndex(h => h === 'BLK' || h === 'BLOCK');
          const tempLotIdx = normalizedVals.findIndex(h => h === 'LOT');

          // If a row has name, blk, and lot, it is our header row!
          if (tempNameIdx !== -1 && tempBlkIdx !== -1 && tempLotIdx !== -1) {
            headerRowIdx = r;
            nameIdx = tempNameIdx;
            blkIdx = tempBlkIdx;
            lotIdx = tempLotIdx;
            emailIdx = normalizedVals.findIndex(h => h === 'EMAIL' || h === 'EMAILADDRESS');
            phoneIdx = normalizedVals.findIndex(h => h === 'PHONE' || h === 'PHONENUMBER');
            break;
          }
        }

        if (headerRowIdx === -1) {
          setErrorMessage('Could not find header row containing required columns: "NAME", "BLK", "LOT". Please make sure these column headers exist in your sheet.');
          return;
        }

        const tempResidents: ParsedResident[] = [];

        for (let i = headerRowIdx + 1; i < jsonRows.length; i++) {
          const rowValues = jsonRows[i] as any[];
          if (!rowValues || rowValues.length === 0) continue;

          // Check if the entire row is empty
          if (rowValues.every(val => val === null || val === undefined || String(val).trim() === '')) {
            continue;
          }

          const name = rowValues[nameIdx] ? String(rowValues[nameIdx]).trim() : '';
          const blk = rowValues[blkIdx] ? String(rowValues[blkIdx]).trim() : '';
          const lot = rowValues[lotIdx] ? String(rowValues[lotIdx]).trim() : '';
          const email = emailIdx !== -1 && rowValues[emailIdx] ? String(rowValues[emailIdx]).trim() : '';
          const phone = phoneIdx !== -1 && rowValues[phoneIdx] ? String(rowValues[phoneIdx]).trim() : '';

          let isValid = true;
          let validationError = '';

          if (!name) {
            isValid = false;
            validationError = 'Name is required';
          } else if (!blk || !lot) {
            isValid = false;
            validationError = 'Block and Lot are required';
          }

          tempResidents.push({
            NAME: name,
            BLK: blk,
            LOT: lot,
            email: email || undefined,
            phone: phone || undefined,
            isValid,
            validationError,
          });
        }

        if (tempResidents.length === 0) {
          setErrorMessage('No valid resident rows found in the sheet.');
        } else {
          setParsedData(tempResidents);
        }
      } catch (err: any) {
        setErrorMessage(`File parsing error: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit parsed data to backend bulk import with dynamic client-side batching
  const handleImportSubmit = async () => {
    if (parsedData.length === 0) return;
    
    const validRows = parsedData.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage('There are no valid rows to import.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setImportProgress(0);
    setProgressText(`Preparing to import ${validRows.length} residents...`);

    const chunkSize = 10; // Batch into sizes of 10 to guarantee zero server timeout issues!
    const allResults: ImportResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      const getCookieValue = (name: string) => {
        if (typeof document === 'undefined') return '';
        const match = document.cookie.split('; ').find(row => row.startsWith(`${name}=`));
        return match ? decodeURIComponent(match.split('=')[1]) : '';
      };
      const csrfToken = getCookieValue('lh_csrf');

      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize);
        setProgressText(`Importing residents ${i + 1} to ${Math.min(i + chunkSize, validRows.length)} of ${validRows.length}...`);

        const response = await fetch('/api/residents/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify({
            residents: chunk,
            defaultPhase: defaultPhase.trim() || 'NEW AREA & SOCIALIZED',
          }),
        });

        const responseText = await response.text();
        let resData: any = {};
        try {
          if (responseText) resData = JSON.parse(responseText);
        } catch (e) {
          // Safe fall back
        }

        if (!response.ok) {
          throw new Error(resData.error || `Bulk import failed on block ${Math.floor(i / chunkSize) + 1} with status: ${response.status}`);
        }

        successCount += resData.successCount ?? 0;
        failedCount += resData.failedCount ?? 0;
        if (resData.results && Array.isArray(resData.results)) {
          allResults.push(...resData.results);
        }

        const percentage = Math.round((Math.min(i + chunkSize, validRows.length) / validRows.length) * 100);
        setImportProgress(percentage);
      }

      setImportSummary({
        successCount,
        failedCount,
        results: allResults,
      });
      
      onSuccess(); // Trigger list refresh in main dashboard
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during bulk import.');
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
      setProgressText('');
    }
  };

  const resetState = () => {
    setCsvFile(null);
    setParsedData([]);
    setImportSummary(null);
    setErrorMessage(null);
    setImportProgress(null);
    setProgressText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Generates a mock template Excel sheet matching the exact format shown in your image
  const handleDownloadTemplate = () => {
    const wsData = [
      ['NO', 'NAME', 'BLK', 'LOT'],
      [1, 'Vashti Rojo', '1', '1'],
      [2, 'Amadeo Payumo', '1', '2'],
      [3, 'Janet Almeron', '1', '3']
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths so it looks beautiful
    ws['!cols'] = [
      { wch: 8 },  // NO
      { wch: 25 }, // NAME
      { wch: 10 }, // BLK
      { wch: 10 }  // LOT
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Residents Template');
    XLSX.writeFile(wb, 'residents_import_template.xlsx');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Dynamic batch processing loading screen */}
        {isProcessing && importProgress !== null && (
          <div className="progress-overlay-container">
            <div className="progress-status-box">
              <span className="progress-spinner">⚙️</span>
              <h3>{progressText}</h3>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${importProgress}%` }}></div>
              </div>
              <span className="progress-percentage">{importProgress}% Completed</span>
            </div>
          </div>
        )}

        <div className="modal-header">
          <h2>📥 Bulk Import Residents</h2>
          <button className="close-btn" onClick={handleClose}>&times;</button>
        </div>

        <div className="modal-body">
          {errorMessage && (
            <div className="alert alert-error">
              ⚠️ {errorMessage}
            </div>
          )}

          {!importSummary ? (
            <>
              {/* Step 1: Settings & File Upload */}
              <div className="settings-section">
                <div className="form-group">
                  <label className="field-label">Default Phase / Subdivision Area</label>
                  <input
                    type="text"
                    className="modal-input"
                    value={defaultPhase}
                    onChange={(e) => setDefaultPhase(e.target.value)}
                    placeholder="e.g. NEW AREA & SOCIALIZED"
                    disabled={isProcessing}
                  />
                  <small className="help-text">
                    All imported residents will be assigned to this subdivision phase unless specified in the sheet.
                  </small>
                </div>

                <div className="upload-container">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div
                    className="drag-drop-zone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="upload-icon">📊</span>
                    <span className="upload-text">
                      {csvFile ? `Selected: ${csvFile.name}` : 'Click here to choose your CSV or Excel file'}
                    </span>
                    <span className="upload-small">Supports .csv, .xlsx, .xls files containing NAME, BLK, and LOT columns</span>
                  </div>

                  <div className="template-box">
                    <span>Need a format sample?</span>
                    <button className="link-btn" onClick={handleDownloadTemplate}>
                      Download Excel Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Parsed Data Preview Table */}
              {parsedData.length > 0 && (
                <div className="preview-section">
                  <h3>🔍 Row Preview ({parsedData.length} entries found)</h3>
                  <div className="table-wrapper">
                    <table className="modal-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>NAME</th>
                          <th>BLK</th>
                          <th>LOT</th>
                          <th>Generated Email</th>
                          <th>Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.map((row, idx) => {
                          const cleanName = row.NAME.toLowerCase().replace(/[^a-z0-9]/g, '');
                          const autoEmail = row.email || `${cleanName}.blk${row.BLK || '0'}lot${row.LOT || '0'}@lhconnect.com`;
                          return (
                            <tr key={idx} className={row.isValid ? '' : 'row-error'}>
                              <td>{idx + 1}</td>
                              <td className="bold">{row.NAME || <span className="null-val">empty</span>}</td>
                              <td>{row.BLK || <span className="null-val">empty</span>}</td>
                              <td>{row.LOT || <span className="null-val">empty</span>}</td>
                              <td className="monospace italic">{autoEmail}</td>
                              <td>
                                {row.isValid ? (
                                  <span className="badge-ok">Ready</span>
                                ) : (
                                  <span className="badge-err">{row.validationError}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Step 3: Detailed Import Results Summary */
            <div className="summary-section">
              <div className="summary-header-card">
                <div className="summary-stat stat-success">
                  <span className="stat-count">{importSummary.successCount}</span>
                  <span className="stat-label">Residents Registered</span>
                </div>
                <div className="summary-stat stat-failed">
                  <span className="stat-count">{importSummary.failedCount}</span>
                  <span className="stat-label">Failed Row Audits</span>
                </div>
              </div>

              <h3>📋 Detailed Audit Logs</h3>
              <div className="table-wrapper">
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>Registered Login Email</th>
                      <th>Audit Status</th>
                      <th>Error Context / Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSummary.results.map((result, idx) => (
                      <tr key={idx} className={result.status === 'success' ? 'row-success' : 'row-error'}>
                        <td className="bold">{result.name}</td>
                        <td className="monospace">{result.email}</td>
                        <td>
                          {result.status === 'success' ? (
                            <span className="badge-ok">✓ Success</span>
                          ) : (
                            <span className="badge-err">✗ Failed</span>
                          )}
                        </td>
                        <td className="error-reason text-left">
                          {result.error || <span className="success-reason">Registered successfully with password: lhconnect2026</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!importSummary ? (
            <>
              <button className="cancel-btn" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={handleImportSubmit}
                disabled={isProcessing || parsedData.length === 0 || parsedData.filter(r => r.isValid).length === 0}
              >
                {isProcessing ? '⚙ Importing Residents...' : `Confirm Import (${parsedData.filter(r => r.isValid).length} Rows)`}
              </button>
            </>
          ) : (
            <button className="confirm-btn" onClick={handleClose}>
              Done & Close
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1.5rem;
        }

        .modal-container {
          background: #ffffff;
          border-radius: 20px;
          width: 100%;
          max-width: 850px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.8);
          position: relative;
        }

        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .progress-overlay-container {
          background: rgba(255, 255, 255, 0.9);
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .progress-status-box {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 80%;
          max-width: 450px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .progress-spinner {
          font-size: 2.5rem;
          animation: spin 2s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .progress-bar-track {
          width: 100%;
          background: #e2e8f0;
          height: 10px;
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar-fill {
          background: #1B2A4A;
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .progress-percentage {
          font-size: 0.85rem;
          font-weight: 700;
          color: #475569;
        }

        .modal-header {
          padding: 1.25rem 1.75rem;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
        }

        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.75rem;
          cursor: pointer;
          color: #64748b;
          transition: color 0.2s;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #1e293b;
        }

        .modal-body {
          padding: 1.75rem;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .alert {
          padding: 0.85rem 1.25rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fca5a5;
          color: #991b1b;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .field-label {
          font-weight: 700;
          font-size: 0.8rem;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .modal-input {
          padding: 0.75rem 1rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
          color: #1e293b;
          background: #f8fafc;
          transition: all 0.2s;
        }

        .modal-input:focus {
          outline: none;
          border-color: #1B2A4A;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(27, 42, 74, 0.1);
        }

        .help-text {
          font-size: 0.75rem;
          color: #64748b;
        }

        .upload-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 2rem;
          background: #f8fafc;
          align-items: center;
          text-align: center;
          transition: all 0.2s;
        }

        .upload-container:hover {
          border-color: #1B2A4A;
          background: #f1f5f9;
        }

        .drag-drop-zone {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
        }

        .upload-icon {
          font-size: 2.5rem;
        }

        .upload-text {
          font-size: 1rem;
          font-weight: 700;
          color: #1e293b;
        }

        .upload-small {
          font-size: 0.8rem;
          color: #64748b;
        }

        .template-box {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          color: #64748b;
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .link-btn {
          background: none;
          border: none;
          color: #2563eb;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }

        .link-btn:hover {
          color: #1d4ed8;
        }

        .preview-section h3, .summary-section h3 {
          font-size: 1rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0 0 0.85rem 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .table-wrapper {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow-x: auto;
          max-height: 250px;
        }

        .modal-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.85rem;
        }

        .modal-table th {
          background: #f8fafc;
          padding: 0.75rem 1rem;
          font-weight: 700;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .modal-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }

        .modal-table tr:last-child td {
          border-bottom: none;
        }

        .bold {
          font-weight: 600;
          color: #1e293b;
        }

        .monospace {
          font-family: monospace;
          font-size: 0.8rem;
        }

        .italic {
          font-style: italic;
          color: #64748b;
        }

        .null-val {
          color: #cbd5e1;
          font-style: italic;
        }

        .row-error {
          background: #fff5f5;
        }

        .row-success {
          background: #f0fdf4;
        }

        .badge-ok {
          background: #dcfce7;
          color: #16a34a;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .badge-err {
          background: #fee2e2;
          color: #ef4444;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .summary-header-card {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .summary-stat {
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }

        .stat-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #16a34a;
        }

        .stat-failed {
          background: #fef2f2;
          border: 1px solid #fca5a5;
          color: #ef4444;
        }

        .stat-count {
          font-size: 2rem;
          font-weight: 800;
        }

        .stat-label {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .error-reason {
          font-size: 0.8rem;
          color: #dc2626;
          font-weight: 500;
        }

        .success-reason {
          color: #16a34a;
          font-weight: 500;
        }

        .modal-footer {
          padding: 1.25rem 1.75rem;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          background: #f8fafc;
        }

        .cancel-btn {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          padding: 0.65rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .confirm-btn {
          background: #1B2A4A;
          border: none;
          padding: 0.65rem 1.5rem;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          color: #ffffff;
          transition: all 0.2s;
        }

        .confirm-btn:hover:not(:disabled) {
          background: #2C3E6B;
          transform: translateY(-1px);
        }

        .confirm-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
