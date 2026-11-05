import React from 'react';
import { X, Download, Trash2, Image as ImageIcon, Brush, Plus } from 'lucide-react';
import { SavedArtwork } from '../types';
import { generateArtworkFilename } from '../utils/drawing';

interface SessionGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  artworks: SavedArtwork[];
  onDeleteArtwork: (id: string) => void;
  onOpenCanvas: () => void;
}

export const SessionGalleryModal: React.FC<SessionGalleryModalProps> = ({
  isOpen,
  onClose,
  artworks,
  onDeleteArtwork,
  onOpenCanvas,
}) => {
  if (!isOpen) return null;

  const handleDownloadItem = (art: SavedArtwork) => {
    const link = document.createElement('a');
    link.download = generateArtworkFilename(art.title);
    link.href = art.dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-gallery-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <div>
              <h2 id="session-gallery-title" className="text-lg font-bold text-slate-900">
                pixora Studio Gallery
              </h2>
              <p className="text-xs text-slate-500">
                {artworks.length} artwork{artworks.length === 1 ? '' : 's'} created during this session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close session gallery"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Artworks List / Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {artworks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
                <Brush className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">No saved artwork yet</h3>
              <p className="text-xs text-slate-500 max-w-xs mb-6">
                Your finished drawings will appear here when you click "Save" in the studio.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenCanvas();
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Draw on Canvas</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {artworks.map((art) => (
                <div
                  key={art.id}
                  className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-blue-400 hover:shadow-md transition-all"
                >
                  <div className="w-full aspect-square rounded-xl bg-white overflow-hidden p-2 mb-3 flex items-center justify-center border border-slate-100">
                    <img
                      src={art.dataUrl}
                      alt={art.title}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{art.title}</h4>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {art.date}
                      </span>
                    </div>

                    {art.templateName && (
                      <p className="text-[11px] text-blue-600 font-medium mb-2 truncate">
                        Traced from: {art.templateName}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleDownloadItem(art)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-blue-200 cursor-pointer"
                        title="Download PNG again"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>

                      <button
                        onClick={() => onDeleteArtwork(art.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove from gallery"
                        aria-label="Remove artwork"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Gallery
          </button>
        </div>
      </div>
    </div>
  );
};
