'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';

export default function ResidentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [resident, setResident] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResident = async () => {
      try {
        setIsLoading(true);
        const response = await apiCall(`/residents/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setResident(data);
        } else {
          setError('Failed to fetch resident');
        }
      } catch (err) {
        setError('Error loading resident');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResident();
  }, [params.id]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!resident) {
    return <div>Resident not found</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Resident Details</h1>
      <div style={{ marginBottom: '20px' }}>
        <p>
          <strong>Name:</strong> {resident.name}
        </p>
        <p>
          <strong>Phase:</strong> {resident.phase}
        </p>
        <p>
          <strong>Block:</strong> {resident.block}
        </p>
        <p>
          <strong>Lot:</strong> {resident.lot}
        </p>
        <p>
          <strong>Email:</strong> {resident.email}
        </p>
        <p>
          <strong>Phone:</strong> {resident.phone}
        </p>
        <p>
          <strong>Status:</strong> {resident.status}
        </p>
        <p>
          <strong>Balance:</strong> ${resident.balance}
        </p>
      </div>
      <button
        onClick={() => router.push(`/admin/residents/${params.id}/edit`)}
        style={{ padding: '8px 16px', marginRight: '10px' }}
      >
        Edit
      </button>
      <button onClick={() => router.push('/admin/residents')} style={{ padding: '8px 16px' }}>
        Back to Residents
      </button>
    </div>
  );
}
