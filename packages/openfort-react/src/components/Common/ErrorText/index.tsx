'use client'

import styled from '../../../styles/styled'

/**
 * The widget's inline error style: quiet, centered, and placed BELOW the
 * screen's main action — never shouting next to the field it came from.
 */
export const ErrorText = styled.div`
  margin: 12px auto 0;
  text-align: center;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ck-body-color-danger, #fc5a5a);
`
