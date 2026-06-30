import React from 'react';
import styled from 'styled-components';
import { FaSave } from 'react-icons/fa';

const SaveCard = ({ handleSaveCard, isSaving, feedback, className }) => {
  return (
    <SaveButtonContainer className={className}>
      <SaveButton onClick={handleSaveCard} disabled={isSaving}>
        {isSaving ? 'Saving...' : (
          <>
            <FaSave style={{ marginRight: '8px' }} /> Save Card
          </>
        )}
      </SaveButton>
      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}
    </SaveButtonContainer>
  );
};

const SaveButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
`;

const SaveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gold);
  color: #140d03;
  border: 1px solid var(--gold);
  padding: 8px 16px;
  border-radius: 20px;
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  max-width: 200px;

  &:hover {
    background: var(--gold-bright);
    transform: translateY(-1px);
  }

  &:disabled {
    background: transparent;
    color: var(--amber-dim);
    border-color: var(--panel-border);
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
  }
`;

const FeedbackMessage = styled.div`
  background: rgba(40, 167, 69, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  font-size: 12px;
  margin-top: 10px;
`;

export default SaveCard;
