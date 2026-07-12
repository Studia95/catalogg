import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DeliveryStatus } from '../order/orderLifecycle';
import { buildLocalAcceptedOffer, demoDriverId, type DeliveryOffer } from '../../shared/api/deliveryApi';

type DriverStore = {
  selectedDriverId: string;
  localActiveDelivery: DeliveryOffer | null;
  completedDeliveryIds: string[];
  bindDriver: (driverId: string) => void;
  acceptLocalOffer: (offer: DeliveryOffer, driverId?: string) => void;
  updateLocalDeliveryStatus: (status: DeliveryStatus) => void;
  completeLocalDelivery: () => void;
  clearLocalActiveDelivery: () => void;
};

export const useDriverStore = create<DriverStore>()(
  persist(
    (set, get) => ({
      selectedDriverId: demoDriverId,
      localActiveDelivery: null,
      completedDeliveryIds: [],
      bindDriver: (driverId) =>
        set((state) =>
          state.selectedDriverId === driverId
            ? state
            : { selectedDriverId: driverId, localActiveDelivery: null, completedDeliveryIds: [] }
        ),
      acceptLocalOffer: (offer, driverId) =>
        set((state) => ({
          localActiveDelivery: buildLocalAcceptedOffer(offer, driverId ?? state.selectedDriverId)
        })),
      updateLocalDeliveryStatus: (status) =>
        set((state) => ({
          localActiveDelivery: state.localActiveDelivery
            ? {
                ...state.localActiveDelivery,
                status
              }
            : null
        })),
      completeLocalDelivery: () => {
        const activeDelivery = get().localActiveDelivery;
        if (!activeDelivery) return;

        set((state) => ({
          localActiveDelivery: null,
          completedDeliveryIds: [activeDelivery.deliveryId, ...state.completedDeliveryIds]
        }));
      },
      clearLocalActiveDelivery: () => set({ localActiveDelivery: null })
    }),
    {
      name: 'waycatalog-driver',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedDriverId: state.selectedDriverId,
        localActiveDelivery: state.localActiveDelivery,
        completedDeliveryIds: state.completedDeliveryIds
      })
    }
  )
);
