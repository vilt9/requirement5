import React from 'react';
import styled from 'styled-components';

const ControlSection = ({ title, children, className }) => {
  return (
    <StyledControlSection className={className}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </StyledControlSection>
  );
};

const StyledControlSection = styled.div`
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--panel-border);

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  margin-bottom: 15px;
  color: var(--white);
  font-weight: 600;
  letter-spacing: -0.02em;
`;

export default ControlSection;
