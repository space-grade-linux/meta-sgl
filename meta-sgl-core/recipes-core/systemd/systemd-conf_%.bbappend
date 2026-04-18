# Conditionally add a new wired.network file if zeroconf-networking is enabled
FILESEXTRAPATHS:prepend := "${@bb.utils.contains("IMAGE_FEATURES", "zeroconf-networking", "${THISDIR}/${PN}:", "",d)}"
