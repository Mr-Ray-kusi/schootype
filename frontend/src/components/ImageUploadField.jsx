import React from 'react';
import { ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';

const ImageUploadField = ({ label, preview, onPreviewChange, hint }) => {
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onPreviewChange(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <label className="group relative flex items-center justify-center w-full max-w-[280px] aspect-[3/4] mx-auto border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 transition-colors overflow-hidden bg-gray-100">
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-contain object-center p-2"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 px-4 text-center">
            <ImagePlus className="w-10 h-10 mb-2 text-gray-400 group-hover:text-blue-500" />
            <span className="text-sm font-medium">Upload photo</span>
            <span className="text-xs mt-1 text-gray-400">JPG, PNG — max 5MB</span>
            <span className="text-xs mt-2 text-gray-400">Portrait ratio recommended</span>
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
      </label>
      {preview && (
        <button
          type="button"
          onClick={() => onPreviewChange(null)}
          className="mt-2 block mx-auto text-xs text-red-600 hover:text-red-700"
        >
          Remove photo
        </button>
      )}
      {hint && <p className="text-xs text-gray-500 mt-2 text-center">{hint}</p>}
    </div>
  );
};

export default ImageUploadField;
