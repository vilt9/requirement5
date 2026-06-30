import styled from 'styled-components';

export const DebugContainer = styled.div`
  width: 100%;
  max-width: 1400px;
  margin: 50px auto;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
`;

export const DebugHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e0e0e0;
  
  h2 {
    margin: 0;
    color: #333;
    font-weight: 600;
  }
`;

export const ToggleButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  padding: 10px 15px;
  background-color: #4a6cf7;
  color: white;
  border: none;
  border-radius: 5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #3a57d7;
    transform: translateY(-2px);
  }
`;

export const LayerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
`;

export const LayerCard = styled.div`
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
`;

export const LayerTitle = styled.h3`
  margin: 0;
  padding: 15px;
  font-size: 16px;
  font-weight: 600;
  background-color: #f1f3f5;
  border-bottom: 1px solid #e0e0e0;
`;

export const CardDisplay = styled.div`
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background-color: transparent;
  position: relative;
  overflow: visible;
  border-bottom: 1px solid #eee;
  
  /* Set a definitive size for the card to match proportions of main card */
  & > div {
    width: 220px;
    height: 280px;
    transform-style: preserve-3d;
    perspective: 1000px;
  }
`;

export const CardWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  
  /* No extra styling to ensure high fidelity to main card */
  & > * {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 15px;
  }
`;

export const LayerDescription = styled.div`
  padding: 15px;
  flex: 1;
  
  h4 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 14px;
    color: #555;
  }
`;

export const LayerStyles = styled.div`
  font-size: 12px;
  line-height: 1.4;
  max-height: 80px;
  overflow-y: auto;
  padding: 8px 10px;
  background-color: #f7f7f7;
  border-radius: 4px;
  
  code {
    color: #d63384;
  }
`;

export const CSSVariablesSection = styled.div`
  margin-bottom: 30px;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #333;
  }
`;

export const VariablesTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  
  th {
    background-color: #f5f5f5;
    font-weight: 600;
  }
  
  code {
    background-color: #f3f4f5;
    padding: 2px 5px;
    border-radius: 3px;
    color: #d63384;
  }
`;

export const BlendModeSection = styled.div`
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #333;
  }
`;

export const BlendModeTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  
  th {
    background-color: #f5f5f5;
    font-weight: 600;
  }
  
  code {
    background-color: #f3f4f5;
    padding: 2px 5px;
    border-radius: 3px;
    color: #d63384;
  }
`;
