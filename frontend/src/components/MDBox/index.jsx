import { forwardRef } from "react";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";

const MDBox = forwardRef(({ sx, ...rest }, ref) => (
  <Box ref={ref} sx={sx} {...rest} />
));

MDBox.displayName = "MDBox";
MDBox.propTypes = { sx: PropTypes.object };

export default MDBox;
