import React from 'react';
import styled from 'styled-components';
import { FaUpload } from 'react-icons/fa';
import Tooltip from './Tooltip';

const ImageUploader = ({ 
  id, 
  label, 
  onImageChange, 
  previewSrc, 
  accept = "image/*",
  tooltipContent
}) => {
  const handleChange = (e) => {
    
    if (onImageChange) {
      onImageChange(e);
    }
  };

  return (
    <ImageUploadContainer>
      <ImageUploadLabel htmlFor={id}>
        <LabelRow>
          <LabelText>{label}</LabelText>
          {tooltipContent && <Tooltip content={tooltipContent} />}
        </LabelRow>
        <UploadButton>
          <FaUpload /> Upload Image
        </UploadButton>
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        {previewSrc && (
          <ImagePreview 
            src={previewSrc} 
            alt={`${label} preview`} 
          />
        )}
      </ImageUploadLabel>
    </ImageUploadContainer>
  );
};


const ImageUploadContainer = styled.div`
  width: 100%;
  margin-bottom: 16px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
`;

const LabelText = styled.span`
  font-size: 11px;
  color: #ccc;
`;

const ImageUploadLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
`;

const UploadButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ImagePreview = styled.img`
  width: 100%;
  height: auto;
  max-height: 100px;
  object-fit: contain;
  border-radius: 4px;
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.2);
`;

export default ImageUploader;
