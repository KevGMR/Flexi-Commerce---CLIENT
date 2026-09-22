"use client";

import { useEffect } from "react";
import Modal from "@/components/ui/Modal";
import AddToSalePanel from "@/components/sales/AddToSalePanel";

export default function AddToSaleModal({ isOpen, onClose, saleId, currentItems, pendingRemovedLine, onAddSuccess }) {
  useEffect(() => {
    // keep body scroll locked handled by Modal
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add products" ariaLabel="Add products dialog">
      <div className="max-h-[70vh] overflow-auto">
        <AddToSalePanel
          saleId={saleId}
          currentItems={currentItems}
          pendingRemovedLine={pendingRemovedLine}
          onAddSuccess={async () => {
            if (onAddSuccess) await onAddSuccess();
            onClose?.();
          }}
          onCancel={() => onClose?.()}
        />
      </div>
    </Modal>
  );
}
