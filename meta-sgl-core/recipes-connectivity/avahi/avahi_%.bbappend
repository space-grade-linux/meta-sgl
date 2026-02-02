FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

SRC_URI += " \
   ${@bb.utils.contains_any('IMAGE_FEATURES', 'ssh-server-dropbear ssh-server-openssh', 'file://ssh.service', '', d)} \
"

do_install:append() {
    if ${@bb.utils.contains_any('IMAGE_FEATURES', 'ssh-server-dropbear ssh-server-openssh', 'true', 'false', d)}; then
        install -d ${D}${sysconfdir}/avahi/services
        install -m 0644 ${WORKDIR}/ssh.service ${D}${sysconfdir}/avahi/services/
    fi
}
