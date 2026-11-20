import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ResizeCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWidth: number;
  currentHeight: number;
  onApplyResize: (newWidth: number, newHeight: number, scaleContent: boolean) => void;
}

export const ResizeCanvasModal: React.FC<ResizeCanvasModalProps> = ({
  isOpen,
  onClose,
  currentWidth,
  currentHeight,
  onApplyResize,
}) => {
  const [unit, setUnit] = useState<'pixels' | 'percent'>('pixels');
  const [widthInput, setWidthInput] = useState<number>(currentWidth);
  const [heightInput, setHeightInput] = useState<number>(currentHeight);
  const [keepAspect, setKeepAspect] = useState<boolean>(true);
  const [scaleArtwork, setScaleArtwork] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setUnit('pixels');
      setWidthInput(currentWidth);
      setHeightInput(currentHeight);
      setKeepAspect(true);
      setScaleArtwork(true);
    }
  }, [isOpen, currentWidth, currentHeight]);

  if (!isOpen) return null;

  const handleUnitChange = (nextUnit: 'pixels' | 'percent') => {
    if (nextUnit === unit) return;
    if (nextUnit === 'percent') {
      setWidthInput(Math.round((widthInput / currentWidth) * 100));
      setHeightInput(Math.round((heightInput / currentHeight) * 100));
    } else {
      setWidthInput(Math.max(10, Math.round((widthInput / 100) * currentWidth)));
      setHeightInput(Math.max(10, Math.round((heightInput / 100) * currentHeight)));
    }
    setUnit(nextUnit);
  };

  const handleWidthChange = (val: number) => {
    const safeVal = Math.max(1, val || 1);
    setWidthInput(safeVal);
    if (keepAspect) {
      if (unit === 'percent') {
        setHeightInput(safeVal);
      } else {
        setHeightInput(Math.max(10, Math.round((safeVal / currentWidth) * currentHeight)));
      }
    }
  };

  const handleHeightChange = (val: number) => {
    const safeVal = Math.max(1, val || 1);
    setHeightInput(safeVal);
    if (keepAspect) {
      if (unit === 'percent') {
        setWidthInput(safeVal);
      } else {
        setWidthInput(Math.max(10, Math.round((safeVal / currentHeight) * currentWidth)));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetW =
      unit === 'pixels'
        ? Math.max(50, Math.min(4096, Math.round(widthInput)))
        : Math.max(50, Math.min(4096, Math.round((widthInput / 100) * currentWidth)));
    const targetH =
      unit === 'pixels'
        ? Math.max(50, Math.min(4096, Math.round(heightInput)))
        : Math.max(50, Math.min(4096, Math.round((heightInput / 100) * currentHeight)));

    onApplyResize(targetW, targetH, scaleArtwork);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resize-dialog-title"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-[320px] bg-[#F0F0F0] border border-[#8E8E8E] shadow-lg text-[12px] text-[#1E1E1E] font-sans cursor-default"
      >
        <div className="bg-white px-2.5 py-1.5 border-b border-[#DADBDC] flex items-center justify-between">
          <h2 id="resize-dialog-title" className="text-[12px] font-normal text-[#1E1E1E]">
            Resize and Skew
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 hover:bg-[#E81123] hover:text-white text-[#1E1E1E] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3 flex flex-col gap-3">
          <fieldset className="border border-[#D0D0D0] p-2.5 bg-[#F5F6F7]">
            <legend className="px-1 text-[11px] font-medium text-[#1E1E1E]">Resize</legend>

            <div className="flex items-center gap-4 mb-2.5">
              <span className="text-[#444]">By:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="resizeUnit"
                  checked={unit === 'percent'}
                  onChange={() => handleUnitChange('percent')}
                />
                <span>Percentage</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="resizeUnit"
                  checked={unit === 'pixels'}
                  onChange={() => handleUnitChange('pixels')}
                />
                <span>Pixels</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 items-center mb-2">
              <label className="text-[11px]">Horizontal:</label>
              <input
                type="number"
                min={unit === 'pixels' ? 50 : 10}
                max={unit === 'pixels' ? 4096 : 500}
                value={widthInput}
                onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                className="bg-white border border-[#ADADAD] px-1.5 py-0.5 text-[12px] focus:outline-none focus:border-[#0078D7]"
              />
              <label className="text-[11px]">Vertical:</label>
              <input
                type="number"
                min={unit === 'pixels' ? 50 : 10}
                max={unit === 'pixels' ? 4096 : 500}
                value={heightInput}
                onChange={(e) => handleHeightChange(parseInt(e.target.value, 10))}
                className="bg-white border border-[#ADADAD] px-1.5 py-0.5 text-[12px] focus:outline-none focus:border-[#0078D7]"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] mb-1">
              <input
                type="checkbox"
                checked={keepAspect}
                onChange={(e) => setKeepAspect(e.target.checked)}
              />
              <span>Maintain aspect ratio</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={scaleArtwork}
                onChange={(e) => setScaleArtwork(e.target.checked)}
              />
              <span>Stretch artwork to new size</span>
            </label>
          </fieldset>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="px-5 py-1 bg-[#E1E1E1] hover:bg-[#E5F1FB] border border-[#0078D7] text-[#1E1E1E] text-[12px] cursor-pointer"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 bg-[#E1E1E1] hover:bg-[#E5F1FB] border border-[#ADADAD] text-[#1E1E1E] text-[12px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
