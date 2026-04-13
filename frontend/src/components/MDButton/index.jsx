import { forwardRef } from "react";
import Button from "@mui/material/Button";
import PropTypes from "prop-types";

const MDButton = forwardRef(
  ({ color = "primary", variant = "contained", size = "medium", children, sx, ...rest }, ref) => (
    <Button
      ref={ref}
      color={color}
      variant={variant}
      size={size}
      sx={{ fontWeight: 700, borderRadius: "8px", ...sx }}
      {...rest}
    >
      {children}
    </Button>
  )
);

MDButton.displayName = "MDButton";
MDButton.propTypes = {
  color: PropTypes.string,
  variant: PropTypes.oneOf(["text", "contained", "outlined"]),
  size: PropTypes.oneOf(["small", "medium", "large"]),
  children: PropTypes.node,
  sx: PropTypes.object,
};

export default MDButton;
