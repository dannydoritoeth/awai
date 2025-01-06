'use client';

import { createContext, useContext, useState } from 'react';
import { BookingModal } from '@/components/common/BookingModal';

interface BookingModalContextType {
  openModal: () => void;
  closeModal: () => void;
}

const BookingModalContext = createContext<BookingModalContextType>({
  openModal: () => {},
  closeModal: () => {},
});

export function BookingModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <BookingModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <BookingModal isOpen={isOpen} onClose={closeModal} />
    </BookingModalContext.Provider>
  );
}

export const useBookingModal = () => useContext(BookingModalContext); 