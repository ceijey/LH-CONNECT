'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';

interface ResidentFormData {
  name: string;
  phase: string;
  block: string;
  lot: string;
  email: string;
  phone: string;
}

export default function EditResidentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [resident, setResident] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<ResidentFormData>({
    name: '',
    phase: '',
    block: '',
    lot: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    const fetchResident = async () => {
      try {
        setIsLoading(true);
        const response = await apiCall(`/residents/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setResident(data);
          setFormData({
            name: data.name,
            phase: data.phase,
            block: data.block,
            lot: data.lot,
            email: data.email,
            phone: data.phone,
          });
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiCall(`/residents/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/admin/residents');
      } else {
        setError('Failed to update resident');
      }
    } catch (err) {
      setError('Error updating resident');
      console.error(err);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Edit Resident</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            style={{ display: 'block', width: '100%', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Phase:</label>
          <input
            type="text"
            name="phase"
            value={formData.phase}
            onChange={handleInputChange}
            style={{ display: 'block', width: '100%', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Block:</label>
          <input
            type="text"
            name="block"
            value={formData.block}
            onChange={handleInputChange}
            style={{ display: 'block', width: '100%', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Lot:</label>
          <input
            type="text"
            name="lot"
            value={formData.lot}
            onChange={handleInputChange}
            style={{ display: 'block', width: '100%', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            style={{ display: 'block', width: '100%', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Phone:</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            style={{ display: 'block', width: '100%', padding: '5px' }}
          />
        </div>
        <button type="submit" style={{ padding: '8px 16px', marginRight: '10px' }}>
          Save Changes
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/residents')}
          style={{ padding: '8px 16px' }}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
