import { forwardRef } from "react";
import Typography from "@mui/material/Typography";
import PropTypes from "prop-types";

const MDTypography = forwardRef(
  ({ color, fontWeight, textTransform, opacity = 1, sx, ...rest }, ref) => (
    <Typography
      ref={ref}
      sx={{
        color: color ? `${color}.main` : undefined,
        fontWeight: fontWeight || undefined,
        textTransform: textTransform || undefined,
        opacity,
        ...sx,
      }}
      {...rest}
    />
  )
);

MDTypography.displayName = "MDTypography";
MDTypography.propTypes = {
  color: PropTypes.string,
  fontWeight: PropTypes.oneOf(["light", "regular", "medium", "bold"]),
  textTransform: PropTypes.string,
  opacity: PropTypes.number,
  sx: PropTypes.object,
};

export default MDTypography;
