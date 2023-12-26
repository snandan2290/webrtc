Name:		MCP-webclient
# Developers: please modify the Version when making code changes
Version:	4.38.1
# Developers: do NOT modify the Release
Release:	1%{?dist}
Summary:	MCP Webclient

Group:		System/Libraries
License:	(c), (p) Movius Interactive Inc.
Source0:	%{_sourcedir}/
BuildRoot:	%(mktemp -ud %{_tmppath}/%{name}-%{version}-%{release}-XXXXXX)
AutoReqProv:	no

%define bck_dir /opt/mcp/webclient/.backups
%define bck_file index.html.restore
%define org_file_path /opt/mcp/webclient/movius-web/index.html

%define mldt_version 6.0.1

%description
WebClient

%prep
mkdir -p %{_topdir}/BUILD/%{name}-%{version}/
rm -rf %{_topdir}/BUILD/%{name}-%{version}/*
/bin/cp -rpf %{_sourcedir}/* %{_topdir}/BUILD/%{name}-%{version}/

%build
cd %{_topdir}/BUILD/%{name}-%{version}/

%install
rm -rf $RPM_BUILD_ROOT
cd %{_topdir}/BUILD/%{name}-%{version}/
mkdir -p $RPM_BUILD_ROOT/opt/mcp/webclient

/bin/cp -rpf %{_sourcedir}/dist/apps/movius-web $RPM_BUILD_ROOT/opt/mcp/webclient/

/bin/cp -rpf %{_topdir}/BUILD/%{name}-%{version}/apps/movius-web/src/index.cgi $RPM_BUILD_ROOT/opt/mcp/webclient/movius-web/

%pre
if [ "$1" = "1" ] 
then
	#Do pre install operaton
	:
elif [ "$1" = "2" ]
then 
	#Do Pre upgrade operations
	#Taking backup of existing index.html file
	mkdir -p %{bck_dir}
	if [ -f %{org_file_path} ]; then
		echo "Taking backup of %{org_file_path} file configurations"
		cp -rpf %{org_file_path} %{bck_dir}/%{bck_file}
	fi	
fi

%post

chmod +x /opt/mcp/webclient/movius-web/index.cgi

if [ ! -e /opt/mcp/oamp-gui/public/movius-web ]; then
	ln -s /opt/mcp/webclient/movius-web /opt/mcp/oamp-gui/public/
fi
if [ "$1" = "1" ] 
then
	#Do pre install operaton
	echo "Please follow the MOP to update %{org_file_path} file configuration"
elif [ "$1" = "2" ]
then
	#Do Pre upgrade operations
	#Update index.html with the confguration available in the backup file
	if [ -f %{bck_dir}/%{bck_file} ]
	then
		echo "Updating %{org_file_path} with previous cofiguration found"
		op=$(grep window.MOVIUS_ %{bck_dir}/%{bck_file} | tee /var/tmp/grp_res)
		IFS='='
		while read -r line; do
			read -ra arr <<< "$line"
			find="'"
			replace="\x27"
			line=${line//$find/$replace}
			find="/"
			replace="\/"
			line=${line//$find/$replace}
			#echo "sed -i -e \"s/${arr[0]}*.*/$line/g\" %{org_file_path}"
			sed -i -e "s/${arr[0]}*.*/$line/g" %{org_file_path}
		done < /var/tmp/grp_res
		$(rm -rf /var/tmp/grp_res)
		echo "Patching %{org_file_path} file with previous configurations is done"
	else
		echo "Follow MOP to update %{org_file_path} file configuration"
	fi	
fi

if [ ! -e /opt/mcp/webclient/movius-web/version ]; then
  touch /opt/mcp/webclient/movius-web/version
fi
echo "%{mldt_version}" > /opt/mcp/webclient/movius-web/version


%preun

%postun

%clean
rm -rf $RPM_BUILD_ROOT

%files
/opt/mcp/webclient
%changelog
