import React, { useState } from 'react';
import styled from 'styled-components';
import { FaInfoCircle } from 'react-icons/fa';

const Tooltip = ({ content }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <TooltipContainer>
      <InfoIcon 
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
      >
        <FaInfoCircle />
      </InfoIcon>
      {isVisible && (
        <TooltipContent>
          {content}
        </TooltipContent>
      )}
    </TooltipContainer>
  );
};

const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
  margin-left: 5px;
`;

const InfoIcon = styled.span`
  cursor: pointer;
  color: var(--amber-dim);
  font-size: 14px;
  display: flex;
  align-items: center;

  &:hover, &:focus {
    color: var(--gold-bright);
    outline: none;
  }
`;

const TooltipContent = styled.div`
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  background-color: #15110a;
  border: 1px solid var(--panel-border);
  color: var(--amber-text);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  width: max-content;
  max-width: 250px;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);

  &:after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #15110a transparent transparent transparent;
  }
`;

export default Tooltip;
